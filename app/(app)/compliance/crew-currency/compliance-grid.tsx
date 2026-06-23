import type {
  CurrencyItemRef,
  PilotComplianceRow,
  PilotCurrencyCell,
} from "@/lib/api/types";

import { STATUS_TOKENS, daysUntil } from "./status-tokens";
import type { CurrencyStatus } from "./types";

/**
 * The grid itself — Spec 5 §"Grid View".
 *
 * MVP scope:
 *   - Row header: pilot name + overall-status pill
 *   - Column headers: each currency item abbreviated (hover shows
 *     full name + regulation via native `title` attribute)
 *   - Cells: status pill + grace-day countdown when applicable
 *   - Empty state when no pilots match the active filter
 *
 * Deferred:
 *   - Frozen header rows/columns on scroll (CSS `position: sticky`
 *     with the right z-index dance — comes in the polish pass)
 *   - Cell click → Log Completion modal (PR 4)
 *   - Last-completed-date tooltip
 *   - Per-column sort
 */
export function ComplianceGrid({
  items,
  rows,
  activeFilter,
}: {
  items: CurrencyItemRef[];
  rows: PilotComplianceRow[];
  activeFilter: CurrencyStatus | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          {activeFilter
            ? `No pilots match the ${STATUS_TOKENS[activeFilter].label.toLowerCase()} filter.`
            : "No active pilots on this tenant yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-max min-w-full text-left text-xs">
        <thead className="border-b border-border bg-card/60 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <tr>
            <th className="sticky left-0 z-10 bg-card/95 px-3 py-2">
              Pilot
            </th>
            {items.map((item) => (
              <th
                key={item.id}
                title={`${item.name} — ${item.regulation}`}
                className="px-3 py-2 align-bottom whitespace-nowrap"
              >
                <div>{abbreviateItemName(item)}</div>
                <div className="mt-0.5 text-[0.55rem] font-normal text-muted-foreground/70">
                  {item.regulation}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const overallToken = STATUS_TOKENS[row.overall_status];
            return (
              <tr
                key={row.pilot.id}
                className={`border-b border-border/60 last:border-b-0 ${overallToken.rowTint}`}
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-card/95 px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {row.pilot.full_name}
                    </span>
                    <span className={overallToken.pill}>
                      {overallToken.label}
                    </span>
                  </div>
                  <div className="text-[0.6rem] font-normal text-muted-foreground/70">
                    {row.pilot.email}
                  </div>
                </th>
                {items.map((item) => {
                  const cell = row.cells.find(
                    (c) => c.currency_item_id === item.id,
                  );
                  return (
                    <td key={item.id} className="px-3 py-2 align-top">
                      {cell ? <Cell cell={cell} /> : <span>—</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ cell }: { cell: PilotCurrencyCell }) {
  const token = STATUS_TOKENS[cell.status];
  // Grace-month cells render "GRACE — X days" per Spec 5 §"Cell
  // badge colors". We compute the countdown from grace_month_end.
  let label = token.label;
  if (cell.status === "grace_month") {
    const remaining = daysUntil(cell.grace_month_end);
    if (remaining !== null && remaining >= 0) {
      label = `Grace — ${remaining}d`;
    }
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={token.pill}
        title={
          cell.last_completed_date
            ? `Last completed ${cell.last_completed_date}`
            : "No completion logged"
        }
      >
        {label}
      </span>
    </div>
  );
}

/** Abbreviated column name for the grid header. Long names ("Initial
 *  Competency Check") would blow up the column width; using a short
 *  form per item keeps the grid scannable. Falls back to the full
 *  name when no abbreviation exists. */
function abbreviateItemName(item: CurrencyItemRef): string {
  return ABBREVIATIONS[item.code] ?? item.name;
}

const ABBREVIATIONS: Record<string, string> = {
  competency_check: "Compt.",
  ipc: "IPC",
  night_ifr_approaches: "Night/IFR",
  pic_check: "PIC",
  cfit_training: "CFIT",
  crm_initial: "CRM Init",
  crm_recurrent: "CRM Rec",
  emergency_procedures: "Emerg",
  hazmat_awareness: "Hazmat",
  security_training: "Security",
  medical_certificate: "Medical",
  ifr_currency: "IFR Curr",
  day_landing_currency: "Day Ldg",
  night_landing_currency: "Nt Ldg",
};
