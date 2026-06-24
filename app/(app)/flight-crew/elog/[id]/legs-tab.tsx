import type { FlightLogLeg, FlightLogStatus } from "@/lib/api/types";

import { AddLegButton } from "./add-leg-button";
import { LegCard } from "./leg-card";

/**
 * Tab 2 of the 7-tab elog — Spec 4 §"Electronic Flight Log / Tab 2".
 *
 * Renders one card per leg in the log + an "+ Add Leg" button (draft
 * only). Each card lets the pilot edit the leg's fields inline; saves
 * fire on blur via a server-action wrapper around PATCH /legs/{id}.
 *
 * Computed totals (flight time / block time / hobbs delta) live in
 * the leg card itself — pure math from the saved row + active input
 * state, so they update as the pilot types.
 *
 * Submitted-log behavior:
 *   - Add Leg + Delete + Save are all disabled (matches Spec 4
 *     §"Submit Log button: closed for further edits").
 *   - Fields render read-only.
 */
export function LegsTab({
  logId,
  logStatus,
  initialLegs,
}: {
  logId: string;
  logStatus: FlightLogStatus;
  initialLegs: FlightLogLeg[];
}) {
  const readOnly = logStatus === "submitted";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Legs
          </h2>
          <p className="mt-1 text-[0.7rem] text-muted-foreground/80">
            {initialLegs.length === 0
              ? "No legs yet — add the first leg below."
              : `${initialLegs.length} leg${initialLegs.length === 1 ? "" : "s"} on this log.`}
          </p>
        </div>
        {!readOnly && <AddLegButton logId={logId} />}
      </div>

      {initialLegs.length === 0 && readOnly && (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-10 text-center">
          <p className="text-xs text-muted-foreground">
            No legs on this submitted log.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {initialLegs.map((leg) => (
          <li key={leg.id}>
            <LegCard logId={logId} leg={leg} readOnly={readOnly} />
          </li>
        ))}
      </ul>
    </div>
  );
}
