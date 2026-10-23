"use client";

import { AircraftTypesCard } from "@/components/settings/aircraft-types-card";
import type { ComplianceSettings } from "@/lib/api/type-qualifications";
import type { FleetType } from "@/lib/fleet-types";

import { setVfrOnlyTypesAction } from "./actions";

/**
 * Aircraft that are not IFR certified (#89).
 *
 * The client's GOM: "For dispatchable flight we need a minimum of 600 ft
 * ceilings and 2 sm of visibility for VFR flight in IFR conditions", and
 * the 207 and the Airvan are not IFR certified. Release refuses these
 * types below the dispatch minimums set above. Empty to start, so
 * nothing changes until the DO says which types.
 */
export function VfrOnlyCard({
  settings,
  fleetTypes,
  canChange,
  minimums,
}: {
  settings: ComplianceSettings;
  fleetTypes: FleetType[];
  /** RELEASE_POLICY_ADMINS: the Director of Operations or an Exec Admin. */
  canChange: boolean;
  minimums: { ceilingFt: number; visibilitySm: number };
}) {
  return (
    <AircraftTypesCard
      id="vfr-only"
      title="Aircraft not IFR certified"
      description={`Release refuses these aircraft while the ceiling is below ${minimums.ceilingFt.toLocaleString("en-US")} ft or the visibility below ${minimums.visibilitySm} sm at the departure, the destination or any stop between: the company’s dispatch minimums above. It reads the latest METAR, and a village report from the last 6 hours. No acknowledgment clears it, and their FRAT scores that weather over company limits.`}
      legend="Aircraft that are not IFR certified"
      // Absent from a backend older than #89, which this may deploy before.
      saved={settings.vfr_only_types ?? []}
      changedAt={settings.vfr_only_changed_at}
      changedBy={settings.vfr_only_changed_by}
      fleetTypes={fleetTypes}
      canChange={canChange}
      save={setVfrOnlyTypesAction}
    />
  );
}
