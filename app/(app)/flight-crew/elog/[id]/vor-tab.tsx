import type { FlightLogResponse, FlightType } from "@/lib/api/types";

import { VorCheckCard } from "./vor-card";

/**
 * Tab 6 of the 7-tab elog — Spec 4 §"7-tab Electronic Flight Log /
 * Tab 6: VOR Check (FAR 91.171)".
 *
 * The check is per-log singular (regulation = one within 30 days
 * of any IFR flight). The card renders the input form + a yellow
 * IFR-required hint when the log's flight_type is one of the IFR
 * operations Part 135 calls out — without nagging on training /
 * ferry / advisory legs where 91.171 doesn't apply.
 *
 * Saves go through the new PATCH /flight-logs/{id} endpoint
 * (vor-actions.ts wraps it because apiFetch is server-only).
 */
export function VorTab({ log }: { log: FlightLogResponse }) {
  const readOnly = log.status === "submitted";

  return (
    <div className="space-y-3">
      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        VOR 30-Day Check (FAR 91.171)
      </h2>

      {isIfrFlightType(log.flight_type) && (
        <div
          role="status"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/[0.06] px-4 py-2.5 text-[0.7rem] text-status-yellow"
        >
          IFR flight type selected — VOR check required within 30 days
          for IFR operations.
        </div>
      )}

      <VorCheckCard log={log} readOnly={readOnly} />
    </div>
  );
}

/** Spec 4: charter is the Part 135 IFR-flight bucket today (advisory
 *  / training / ferry are VFR-friendly or non-revenue, so the 91.171
 *  reminder would be noisy on those). Extend this when the
 *  flight_type union grows new IFR-eligible kinds. */
function isIfrFlightType(kind: FlightType): boolean {
  return kind === "charter";
}
