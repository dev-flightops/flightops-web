import Link from "next/link";

import type {
  CurrencyItemRef,
  CurrencyStatus,
  PilotComplianceRow,
  PilotCurrencyCell,
} from "@/lib/api/types";

import { STATUS_TOKENS } from "./status-tokens";

/**
 * Spec 5 / M2-G-3 — month-calendar view of the compliance board.
 *
 * Each (pilot, item) cell with a calendar-month anchor (base or
 * grace) is plotted onto its anchor month. Rolling-days items
 * (IFR / landings) don't have a calendar month — they're rolled
 * into a "This rolling window" lane below the calendar grid.
 *
 * Layout: 12 months forward (Spec 5 §"Calendar view"), this month
 * leftmost, on a 6-column grid → two rows on xl viewports, wraps
 * gracefully to 1/2/3 cols at narrower widths. The 12-month window
 * matches the spec's requirement that a CP can plan recurrent
 * training a full year out.
 *
 * Each month card renders up to 4 colored chips summarising who's
 * due; if more land in the same month a "+N" overflow chip absorbs
 * the rest. The month header is a link — clicking it swaps the
 * calendar for a full drill-in list of every finding in that
 * month (spec: "click month to see who's due"). The URL captures
 * the selection (?month=YYYY-MM) so the deep-link is shareable.
 */

const MONTHS_TO_SHOW = 12;
const MAX_CHIPS_PER_CELL = 4;

export interface CalendarEntry {
  pilot: PilotComplianceRow["pilot"];
  item: CurrencyItemRef;
  cell: PilotCurrencyCell;
  /** Anchor used to bucket into a calendar month — base or grace. */
  anchorMonth: string; // YYYY-MM
}

const INTERESTING_STATUSES = new Set<CurrencyStatus>([
  "non_current",
  "grace_month",
  "due_this_month",
  "early_month",
  "upcoming",
]);

/**
 * Resolve the calendar month a (pilot, item) cell anchors to.
 *
 * Grace cells anchor on `grace_month_end`'s month so they show in
 * the month they expire — that's the deadline the CP is planning
 * around. Otherwise use `base_month_due` (the regular anniversary).
 */
function anchorMonthFor(cell: PilotCurrencyCell): string | null {
  if (cell.status === "grace_month" && cell.grace_month_end) {
    return cell.grace_month_end.slice(0, 7);
  }
  if (cell.base_month_due) {
    return cell.base_month_due.slice(0, 7);
  }
  return null;
}

export function buildCalendarEntries(
  items: CurrencyItemRef[],
  rows: PilotComplianceRow[],
  statusFilter: CurrencyStatus | null,
): { byMonth: Map<string, CalendarEntry[]>; rolling: CalendarEntry[] } {
  const itemsById = new Map(items.map((i) => [i.id, i]));
  const byMonth = new Map<string, CalendarEntry[]>();
  const rolling: CalendarEntry[] = [];

  for (const row of rows) {
    for (const cell of row.cells) {
      const item = itemsById.get(cell.currency_item_id);
      if (!item) continue;
      if (statusFilter) {
        if (cell.status !== statusFilter) continue;
      } else if (!INTERESTING_STATUSES.has(cell.status)) {
        continue;
      }
      if (item.interval_type === "rolling_days") {
        if (cell.status !== "upcoming" && cell.status !== "not_started") {
          rolling.push({ pilot: row.pilot, item, cell, anchorMonth: "" });
        }
        continue;
      }
      const month = anchorMonthFor(cell);
      if (!month) continue;
      const entry: CalendarEntry = { pilot: row.pilot, item, cell, anchorMonth: month };
      const bucket = byMonth.get(month);
      if (bucket) bucket.push(entry);
      else byMonth.set(month, [entry]);
    }
  }
  return { byMonth, rolling };
}

export function ComplianceCalendar({
  items,
  rows,
  statusFilter,
  focusedMonth,
  today,
}: {
  items: CurrencyItemRef[];
  rows: PilotComplianceRow[];
  statusFilter: CurrencyStatus | null;
  /** Optional YYYY-MM — when set, calendar swaps for a drill-in list of
   *  every finding in that month. Comes from ?month= in the URL. */
  focusedMonth?: string | null;
  /** Injectable for tests; defaults to "now" at render time. */
  today?: Date;
}) {
  const { byMonth, rolling } = buildCalendarEntries(items, rows, statusFilter);
  const startDate = today ?? new Date();
  const months = upcomingMonths(startDate, MONTHS_TO_SHOW);

  // Drill-in mode: user clicked a month header. Render the full sorted
  // list for that month + a "back to calendar" link. Focused month
  // outside the current 12-month window still renders (we don't drop
  // stale bookmarks silently — show the entries under a "past" label).
  if (focusedMonth) {
    const entries = byMonth.get(focusedMonth) ?? [];
    const monthCell = months.find((m) => m.key === focusedMonth) ?? {
      key: focusedMonth,
      label: labelForMonthKey(focusedMonth),
    };
    return (
      <FocusedMonthView
        month={monthCell}
        entries={entries}
        statusFilter={statusFilter}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {months.map((m) => {
          const entries = byMonth.get(m.key) ?? [];
          const sorted = sortByStatusUrgency(entries);
          const shown = sorted.slice(0, MAX_CHIPS_PER_CELL);
          const overflow = sorted.length - shown.length;
          const heatmap = heatmapClass(entries);
          return (
            <div
              key={m.key}
              className={
                "rounded-lg border bg-card p-3 " +
                (entries.length === 0
                  ? "border-border/40"
                  : "border-border ") +
                heatmap
              }
            >
              <div className="mb-2 flex items-baseline justify-between">
                <Link
                  href={monthDrillHref(m.key, statusFilter)}
                  className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground hover:text-status-blue"
                  aria-label={
                    entries.length > 0
                      ? `See all ${entries.length} findings in ${m.label}`
                      : `Focus ${m.label}`
                  }
                >
                  {m.label}
                </Link>
                {entries.length > 0 && (
                  <Link
                    href={monthDrillHref(m.key, statusFilter)}
                    className="text-[0.65rem] font-mono text-muted-foreground hover:text-status-blue"
                  >
                    {entries.length}
                  </Link>
                )}
              </div>
              {entries.length === 0 ? (
                <div className="text-[0.65rem] text-muted-foreground/70">
                  Nothing scheduled
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {shown.map((e) => (
                    <li
                      key={`${e.pilot.id}:${e.item.id}`}
                      className="rounded border border-border/60 bg-background/60 p-1.5"
                    >
                      <Link
                        href={`/compliance/pilots/${e.pilot.id}`}
                        className="block text-[0.7rem] font-semibold text-foreground hover:text-status-blue"
                      >
                        {e.pilot.full_name}
                      </Link>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[0.65rem] text-muted-foreground">
                          {e.item.name}
                        </span>
                        <span className={STATUS_TOKENS[e.cell.status].pill}>
                          {STATUS_TOKENS[e.cell.status].label}
                        </span>
                      </div>
                    </li>
                  ))}
                  {overflow > 0 && (
                    <li>
                      <Link
                        href={monthDrillHref(m.key, statusFilter)}
                        className="text-[0.65rem] text-status-blue hover:underline"
                      >
                        +{overflow} more
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {rolling.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Rolling-window items (no calendar anchor)
          </div>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {sortByStatusUrgency(rolling).map((e) => (
              <li
                key={`${e.pilot.id}:${e.item.id}`}
                className="rounded border border-border/60 bg-background/60 p-1.5"
              >
                <Link
                  href={`/compliance/pilots/${e.pilot.id}`}
                  className="block text-[0.7rem] font-semibold text-foreground hover:text-status-blue"
                >
                  {e.pilot.full_name}
                </Link>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[0.65rem] text-muted-foreground">
                    {e.item.name}
                  </span>
                  <span className="font-mono text-[0.65rem] text-status-yellow">
                    {e.cell.rolling_count}/{e.item.rolling_threshold}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FocusedMonthView({
  month,
  entries,
  statusFilter,
}: {
  month: MonthCell;
  entries: CalendarEntry[];
  statusFilter: CurrencyStatus | null;
}) {
  const backHref = statusFilter
    ? `/compliance/crew-currency?view=calendar&status=${statusFilter}`
    : "/compliance/crew-currency?view=calendar";
  const sorted = sortByStatusUrgency(entries);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {month.label} — {entries.length}{" "}
            {entries.length === 1 ? "finding" : "findings"}
          </h2>
          <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
            Every currency item anchored to {month.label} (base month or
            grace end).
          </p>
        </div>
        <Link
          href={backHref}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-[0.7rem] font-semibold text-foreground hover:bg-muted/40"
        >
          ← Back to 12-month view
        </Link>
      </div>
      {sorted.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing anchored to this month.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((e) => (
            <li
              key={`${e.pilot.id}:${e.item.id}`}
              className="rounded border border-border bg-card p-2"
            >
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/compliance/pilots/${e.pilot.id}`}
                  className="text-sm font-semibold text-foreground hover:text-status-blue"
                >
                  {e.pilot.full_name}
                </Link>
                <span className={STATUS_TOKENS[e.cell.status].pill}>
                  {STATUS_TOKENS[e.cell.status].label}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[0.65rem] text-muted-foreground">
                <span className="truncate">{e.item.name}</span>
                <span className="font-mono">{e.item.regulation}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Density heatmap for the empty-space background of each month card.
 * Tuned so the CP can eyeball workload distribution across a year at
 * a glance without reading counts — matches the spec's "heatmap"
 * requirement. Palette derives from status-yellow (upcoming volume
 * is neutral-to-warn) rather than red (red is reserved for the
 * status pills on individual findings).
 */
function heatmapClass(entries: CalendarEntry[]): string {
  const n = entries.length;
  if (n === 0) return "";
  if (n <= 2) return "bg-status-yellow/[0.04]";
  if (n <= 5) return "bg-status-yellow/[0.08]";
  if (n <= 9) return "bg-status-yellow/[0.14]";
  return "bg-status-yellow/[0.20]";
}

function monthDrillHref(
  monthKey: string,
  statusFilter: CurrencyStatus | null,
): string {
  const params = new URLSearchParams();
  params.set("view", "calendar");
  params.set("month", monthKey);
  if (statusFilter) params.set("status", statusFilter);
  return `/compliance/crew-currency?${params.toString()}`;
}

function labelForMonthKey(key: string): string {
  // key: YYYY-MM. Fall back to the raw key if malformed.
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return key;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(d);
}

interface MonthCell {
  key: string; // YYYY-MM
  label: string; // "Jun 2026"
}

function upcomingMonths(from: Date, count: number): MonthCell[] {
  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  });
  const cells: MonthCell[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(from.getUTCFullYear(), from.getUTCMonth() + i, 1);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    cells.push({ key: `${yy}-${mm}`, label: monthFormatter.format(d) });
  }
  return cells;
}

const STATUS_URGENCY: Record<CurrencyStatus, number> = {
  non_current: 0,
  grace_month: 1,
  due_this_month: 2,
  early_month: 3,
  upcoming: 4,
  not_started: 5,
};

function sortByStatusUrgency(entries: CalendarEntry[]): CalendarEntry[] {
  return [...entries].sort((a, b) => {
    const d = STATUS_URGENCY[a.cell.status] - STATUS_URGENCY[b.cell.status];
    if (d !== 0) return d;
    return a.pilot.full_name.localeCompare(b.pilot.full_name);
  });
}
