import Link from "next/link";

import type {
  CurrencyItemRef,
  CurrencyStatus,
  PilotComplianceRow,
  PilotCurrencyCell,
} from "@/lib/api/types";

import { STATUS_TOKENS, daysUntil } from "./status-tokens";

/**
 * Spec 5 / M2-G-3 — flat list view of the compliance board.
 *
 * One row per (pilot, item) the CP would care about — i.e. anything
 * NOT in the boring statuses (UPCOMING + NOT_STARTED). Sort runs
 * status-urgency-first (non-current → grace → due → early), then by
 * grace_month_end ascending so the soonest-decaying items float to
 * the top.
 *
 * Click a row's pilot name → pilot profile (existing route).
 *
 * Active status filter (from the URL) narrows the list further;
 * `statusFilter === null` keeps the urgency-only default.
 */
export interface ComplianceListEntry {
  pilot: PilotComplianceRow["pilot"];
  item: CurrencyItemRef;
  cell: PilotCurrencyCell;
}

const STATUS_URGENCY: Record<CurrencyStatus, number> = {
  non_current: 0,
  grace_month: 1,
  due_this_month: 2,
  early_month: 3,
  upcoming: 4,
  not_started: 5,
};

const INTERESTING_STATUSES = new Set<CurrencyStatus>([
  "non_current",
  "grace_month",
  "due_this_month",
  "early_month",
]);

export function buildListEntries(
  items: CurrencyItemRef[],
  rows: PilotComplianceRow[],
  statusFilter: CurrencyStatus | null,
): ComplianceListEntry[] {
  const itemsById = new Map(items.map((i) => [i.id, i]));
  const entries: ComplianceListEntry[] = [];
  for (const row of rows) {
    for (const cell of row.cells) {
      const item = itemsById.get(cell.currency_item_id);
      if (!item) continue;
      if (statusFilter) {
        if (cell.status !== statusFilter) continue;
      } else if (!INTERESTING_STATUSES.has(cell.status)) {
        continue;
      }
      entries.push({ pilot: row.pilot, item, cell });
    }
  }
  entries.sort((a, b) => {
    const urgencyDelta =
      STATUS_URGENCY[a.cell.status] - STATUS_URGENCY[b.cell.status];
    if (urgencyDelta !== 0) return urgencyDelta;
    const aGrace = a.cell.grace_month_end ?? "9999-12-31";
    const bGrace = b.cell.grace_month_end ?? "9999-12-31";
    if (aGrace !== bGrace) return aGrace < bGrace ? -1 : 1;
    return a.pilot.full_name.localeCompare(b.pilot.full_name);
  });
  return entries;
}

export function ComplianceList({
  items,
  rows,
  statusFilter,
}: {
  items: CurrencyItemRef[];
  rows: PilotComplianceRow[];
  statusFilter: CurrencyStatus | null;
}) {
  const entries = buildListEntries(items, rows, statusFilter);

  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
        {statusFilter
          ? `No pilots in ${STATUS_TOKENS[statusFilter].label.toLowerCase()} status right now.`
          : "Every pilot is fully current. Nothing to flag."}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Pilot</th>
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2 text-left">Regulation</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Anchor</th>
            <th className="px-3 py-2 text-left">Last Completed</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, idx) => (
            <tr
              key={`${e.pilot.id}:${e.item.id}`}
              className={
                idx % 2 === 0
                  ? "border-t border-border/60"
                  : "border-t border-border/60 bg-card/40"
              }
            >
              <td className="px-3 py-2">
                <Link
                  href={`/compliance/pilots/${e.pilot.id}`}
                  className="font-semibold text-foreground hover:text-status-blue"
                >
                  {e.pilot.full_name}
                </Link>
              </td>
              <td className="px-3 py-2 text-foreground">{e.item.name}</td>
              <td className="px-3 py-2 font-mono text-[0.65rem] text-muted-foreground">
                {e.item.regulation}
              </td>
              <td className="px-3 py-2">
                <span className={STATUS_TOKENS[e.cell.status].pill}>
                  {STATUS_TOKENS[e.cell.status].label}
                </span>
              </td>
              <td className="px-3 py-2">
                <AnchorCell item={e.item} cell={e.cell} />
              </td>
              <td className="px-3 py-2 font-mono text-[0.65rem] text-muted-foreground">
                {e.cell.last_completed_date ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnchorCell({
  item,
  cell,
}: {
  item: CurrencyItemRef;
  cell: PilotCurrencyCell;
}) {
  if (item.interval_type === "rolling_days") {
    if (cell.rolling_count !== null && item.rolling_threshold !== null) {
      const remaining = item.rolling_threshold - cell.rolling_count;
      const tone =
        cell.rolling_count >= item.rolling_threshold
          ? "text-status-green"
          : "text-status-yellow";
      return (
        <span className={`font-mono text-[0.65rem] ${tone}`}>
          {cell.rolling_count}/{item.rolling_threshold}
          {remaining > 0 ? ` · ${remaining} short` : ""}
        </span>
      );
    }
    return <span className="text-[0.65rem] text-muted-foreground">—</span>;
  }
  if (cell.status === "grace_month" && cell.grace_month_end) {
    const days = daysUntil(cell.grace_month_end);
    return (
      <span className="font-mono text-[0.65rem] text-status-yellow">
        Grace ends {cell.grace_month_end}
        {days !== null && days >= 0 ? ` · ${days}d` : ""}
      </span>
    );
  }
  if (cell.base_month_due) {
    return (
      <span className="font-mono text-[0.65rem] text-foreground">
        Due {cell.base_month_due.slice(0, 7)}
      </span>
    );
  }
  return <span className="text-[0.65rem] text-muted-foreground">—</span>;
}
