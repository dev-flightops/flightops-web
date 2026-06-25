import Link from "next/link";

import type { FlightLogLeg, FlightLogStatus } from "@/lib/api/types";

import { TrendCard } from "./trend-card";
import { classifyAirframe, familyDisplayName } from "./trend-fields";

/**
 * Tab 5 of the 7-tab elog — Spec 4 §"7-tab Electronic Flight Log /
 * Tab 5: Trends".
 *
 * Aircraft-type aware: the field set per leg comes from
 * `trend-fields.ts` keyed by airframe family. When the aircraft has
 * no airframe_type configured, we render a hint pointing the admin
 * at the aircraft detail page instead of a blank form.
 *
 * Layout mirrors legacy templates/elog/log_page.html Tab 5 — one
 * panel per leg, airframe-family header, then the per-leg trend
 * inputs grouped by Takeoff / Cruise / Engine.
 *
 * Saves piggy-back on the same per-leg PATCH Tabs 2 + 3 use; the
 * card builds the full trend_data object and PATCHes it wholesale.
 */
export function TrendsTab({
  logId,
  logStatus,
  airframeType,
  initialLegs,
}: {
  logId: string;
  logStatus: FlightLogStatus;
  airframeType: string | null;
  initialLegs: FlightLogLeg[];
}) {
  const family = classifyAirframe(airframeType);
  const readOnly = logStatus === "submitted";

  if (initialLegs.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Trends
        </h2>
        <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-10 text-center">
          <p className="text-xs text-muted-foreground">No legs to monitor.</p>
          {!readOnly && (
            <p className="mt-2 text-[0.7rem] text-muted-foreground/80">
              Add a leg on{" "}
              <Link
                href={`/flight-crew/elog/${logId}?tab=legs`}
                className="font-semibold text-status-blue hover:underline"
              >
                Tab 2
              </Link>{" "}
              first — trend samples are per leg.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (family === "unsupported") {
    return (
      <div className="space-y-3">
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Trends
        </h2>
        <div
          role="status"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/[0.06] px-4 py-3 text-xs text-status-yellow"
        >
          Engine trend monitoring not configured for this airframe.
          Set the aircraft&apos;s airframe type (caravan / kingair /
          pilatus / navajo / c207 / ga8) on the Maintenance fleet
          page to enable Tab 5 inputs.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Trends
        </h2>
        <p className="mt-1 text-[0.7rem] text-muted-foreground/80">
          {familyDisplayName(family, airframeType)} ·{" "}
          {initialLegs.length} leg
          {initialLegs.length === 1 ? "" : "s"}
        </p>
      </div>

      <ul className="space-y-3">
        {initialLegs.map((leg) => (
          <li key={leg.id}>
            <TrendCard
              logId={logId}
              leg={leg}
              family={family}
              readOnly={readOnly}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
