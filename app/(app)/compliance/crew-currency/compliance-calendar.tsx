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
 * Layout: 6 months horizontally, this month leftmost. CP at-a-
 * glance sees what's due now / next / next-next so they can plan
 * scheduling around recurrent training.
 *
 * Each calendar cell renders up to 4 colored chips; if more
 * findings land in the same month a "+N" overflow chip absorbs
 * the rest (CP clicks into Grid / List for the full picture).
 */

const MONTHS_TO_SHOW = 6;
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
  today,
}: {
  items: CurrencyItemRef[];
  rows: PilotComplianceRow[];
  statusFilter: CurrencyStatus | null;
  /** Injectable for tests; defaults to "now" at render time. */
  today?: Date;
}) {
  const { byMonth, rolling } = buildCalendarEntries(items, rows, statusFilter);
  const startDate = today ?? new Date();
  const months = upcomingMonths(startDate, MONTHS_TO_SHOW);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {months.map((m) => {
          const entries = byMonth.get(m.key) ?? [];
          const sorted = sortByStatusUrgency(entries);
          const shown = sorted.slice(0, MAX_CHIPS_PER_CELL);
          const overflow = sorted.length - shown.length;
          return (
            <div
              key={m.key}
              className={
                "rounded-lg border bg-card p-3 " +
                (entries.length === 0
                  ? "border-border/40"
                  : "border-border")
              }
            >
              <div className="mb-2 flex items-baseline justify-between">
                <div className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {m.label}
                </div>
                {entries.length > 0 && (
                  <div className="text-[0.65rem] font-mono text-muted-foreground">
                    {entries.length}
                  </div>
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
                    <li className="text-[0.65rem] text-muted-foreground">
                      +{overflow} more
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
