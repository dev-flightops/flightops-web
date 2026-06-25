import Link from "next/link";

import type { FlightLogLeg, FlightLogStatus } from "@/lib/api/types";

import { WeightBalanceCard } from "./wb-card";

/**
 * Tab 3 of the 7-tab elog — Spec 4 §"7-tab Electronic Flight Log /
 * Tab 3: Weight & Balance".
 *
 * One W&B card per leg, keyed to the leg's id. Each card lets the
 * pilot enter the seven Tab 3 inputs (basic empty weight, pilot /
 * SIC / PAX / baggage / cargo, fuel gallons + fuel weight) and
 * shows the running ramp-weight total live. Per-aircraft moment-arm
 * config (needed for takeoff/landing weights + CG) lands in M3;
 * until then those derived rows show a "needs aircraft config" hint.
 *
 * Saves fire on blur through the same per-leg PATCH endpoint Tab 2
 * uses — the backend stores W&B alongside the leg row.
 *
 * Empty state: prompts the pilot to add legs on Tab 2 first.
 */
export function WeightBalanceTab({
  logId,
  logStatus,
  initialLegs,
}: {
  logId: string;
  logStatus: FlightLogStatus;
  initialLegs: FlightLogLeg[];
}) {
  const readOnly = logStatus === "submitted";

  if (initialLegs.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Weight &amp; Balance
        </h2>
        <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-10 text-center">
          <p className="text-xs text-muted-foreground">
            No legs to load yet.
          </p>
          {!readOnly && (
            <p className="mt-2 text-[0.7rem] text-muted-foreground/80">
              Add a leg on{" "}
              <Link
                href={`/flight-crew/elog/${logId}?tab=legs`}
                className="font-semibold text-status-blue hover:underline"
              >
                Tab 2
              </Link>{" "}
              first — W&amp;B is per leg.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Weight &amp; Balance
        </h2>
        <p className="mt-1 text-[0.7rem] text-muted-foreground/80">
          {initialLegs.length} leg{initialLegs.length === 1 ? "" : "s"} —
          enter the load profile for each. Ramp weight updates live;
          takeoff &amp; landing weights + CG ship with the per-aircraft
          moment-arm config in M3.
        </p>
      </div>

      <ul className="space-y-3">
        {initialLegs.map((leg) => (
          <li key={leg.id}>
            <WeightBalanceCard
              logId={logId}
              leg={leg}
              readOnly={readOnly}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
