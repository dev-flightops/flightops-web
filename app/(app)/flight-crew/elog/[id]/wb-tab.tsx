import Link from "next/link";

import { Notice } from "@/components/ff/notice";

import type { FlightLogLeg, FlightLogStatus } from "@/lib/api/types";

import { WeightBalanceCard } from "./wb-card";

/**
 * Tab 3 of the 7-tab elog — Spec 4 §"7-tab Electronic Flight Log /
 * Tab 3: Weight & Balance".
 *
 * One W&B card per leg, keyed to the leg's id. Each card lets the
 * pilot enter the seven Tab 3 inputs (basic empty weight, pilot /
 * SIC / PAX / baggage / cargo, fuel gallons + fuel weight) and
 * shows the running ramp-weight total live.
 *
 * FlightOps holds no moment arms for any aircraft: the CG is worked out
 * in ForeFlight, whose plan the release checks (#181). Legacy's three
 * "needs aircraft config" boxes promised a setting nobody could find
 * (audit 1110-09), so the tab says once what it does and where the rest
 * comes from.
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
  canEdit = true,
}: {
  logId: string;
  logStatus: FlightLogStatus;
  initialLegs: FlightLogLeg[];
  /** False when the caller may read this log but not change it: it is
   *  another pilot's, and they are not a Chief Pilot, DO or Exec Admin. */
  canEdit?: boolean;
}) {
  const readOnly = logStatus === "submitted" || !canEdit;

  if (initialLegs.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="eyebrow">
          Weight &amp; Balance
        </h2>
        <div className="py-6 text-center">
          <p className="text-xs text-muted-foreground">
            No legs to load yet.
          </p>
          {!readOnly && (
            <p className="mt-2 text-[0.7rem] text-muted-foreground">
              Add a leg on the{" "}
              <Link
                href={`/flight-crew/elog/${logId}?tab=legs`}
                className="font-semibold text-primary hover:underline"
              >
                Legs tab
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
        <h2 className="eyebrow">
          Weight &amp; Balance
        </h2>
        <p className="mt-1 text-[0.7rem] text-muted-foreground">
          {initialLegs.length} leg{initialLegs.length === 1 ? "" : "s"} —
          enter the load profile for each. Ramp weight updates live.
        </p>
      </div>
      <Notice tone="blue" label="Ramp weight only">
        FlightOps adds up each leg&rsquo;s ramp weight from the load entered here. It holds no moment arms for the
        aircraft, so it doesn&rsquo;t work out the CG or the takeoff and landing weights: those come from the
        aircraft&rsquo;s weight and balance in ForeFlight or on its W&amp;B form.
      </Notice>

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
