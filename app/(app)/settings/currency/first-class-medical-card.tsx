"use client";

import { AircraftTypesCard } from "@/components/settings/aircraft-types-card";
import type { ComplianceSettings } from "@/lib/api/type-qualifications";
import type { FleetType } from "@/lib/fleet-types";

import { setFirstClassMedicalTypesAction } from "./actions";

export type { FleetType };

/**
 * Aircraft whose PIC needs a first-class medical (#87).
 *
 * The client: "Certain operations such as class I for ATP (Navajo) are
 * required to operate that specific aircraft." A first-class medical is
 * valid for ATP flying for 12 months under 40 and 6 at 40 or over
 * (14 CFR 61.23); release refuses a PIC on these types without one.
 * Empty to start, so nothing changes until the DO says which types.
 */
export function FirstClassMedicalCard({
  settings,
  fleetTypes,
  canChange,
}: {
  settings: ComplianceSettings;
  fleetTypes: FleetType[];
  /** RELEASE_POLICY_ADMINS: the Director of Operations or an Exec Admin. */
  canChange: boolean;
}) {
  return (
    <AircraftTypesCard
      id="first-class-medical"
      title="First-class medical"
      description={
        <>
          The PIC on these aircraft needs a first-class medical that is still valid for
          ATP flying: 12 months under 40, 6 months at 40 or over (14 CFR 61.23). The age
          comes from the date of birth on the employee record; without one, 6 months
          is used. Release is refused otherwise, and a Chief Pilot, Director of
          Operations or Exec Admin can override it for one flight, as for any medical.
        </>
      }
      legend="Aircraft that need a first-class medical"
      // Absent from a backend older than #87, which this may deploy before.
      saved={settings.first_class_medical_types ?? []}
      changedAt={settings.first_class_medical_changed_at}
      changedBy={settings.first_class_medical_changed_by}
      fleetTypes={fleetTypes}
      canChange={canChange}
      save={setFirstClassMedicalTypesAction}
    />
  );
}
