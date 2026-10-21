"use client";

import { useState, useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { ComplianceSettings } from "@/lib/api/type-qualifications";

import { setFirstClassMedicalTypesAction } from "./actions";

export interface FleetType {
  /** The fleet's type slug, as aircraft carry it ("navajo"). */
  slug: string;
  /** What the fleet calls it: the models flying under the slug. */
  label: string;
}

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
  const saved = settings.first_class_medical_types;
  const [chosen, setChosen] = useState<string[]>(saved);
  // A type chosen before its last aircraft left the fleet stays listed, so
  // it can be unticked: the server refuses a list naming it.
  const shown: FleetType[] = [
    ...fleetTypes,
    ...saved
      .filter((slug) => !fleetTypes.some((t) => t.slug === slug))
      .map((slug) => ({ slug, label: "No aircraft in the fleet now" })),
  ];
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    chosen.length !== saved.length || chosen.some((slug) => !saved.includes(slug));

  function toggle(slug: string) {
    setChosen((now) =>
      now.includes(slug) ? now.filter((s) => s !== slug) : [...now, slug],
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const outcome = await setFirstClassMedicalTypesAction(chosen);
      if (!outcome.ok) setError(outcome.error);
    });
  }

  const changed = settings.first_class_medical_changed_at
    ? `Changed ${settings.first_class_medical_changed_at.slice(0, 10)}${
        settings.first_class_medical_changed_by
          ? `, by ${settings.first_class_medical_changed_by.full_name}`
          : ""
      }.`
    : "No aircraft chosen yet.";

  return (
    <section
      aria-labelledby="first-class-medical-heading"
      className="mb-6 rounded-lg border border-border bg-card p-5"
    >
      <h2 id="first-class-medical-heading" className="panel-title">
        First-class medical
      </h2>
      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
        The PIC on these aircraft needs a first-class medical that is still valid for
        ATP flying: 12 months under 40, 6 months at 40 or over (14 CFR 61.23). The age
        comes from the date of birth on the employee record; without one, 6 months
        is used. Release is refused otherwise, and a Chief Pilot, Director of
        Operations or Exec Admin can override it for one flight, as for any medical.
      </p>

      {shown.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No aircraft in the fleet carry a type yet.
        </p>
      ) : (
        <fieldset className="mt-3" disabled={!canChange || pending}>
          <legend className="sr-only">Aircraft that need a first-class medical</legend>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {shown.map((t) => (
              <li key={t.slug}>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={chosen.includes(t.slug)}
                    onChange={() => toggle(t.slug)}
                  />
                  <span className="font-semibold uppercase tracking-[0.06em]">{t.slug}</span>
                  <span className="text-muted-foreground">{t.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{changed}</p>
        {canChange ? (
          <button
            type="button"
            onClick={save}
            disabled={!dirty || pending}
            className="btn-caps inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:bg-brand-dark disabled:opacity-60"
          >
            {pending && <Spinner size="xs" />}
            Save
          </button>
        ) : (
          <p className="max-w-[14rem] text-xs text-muted-foreground">
            The Director of Operations or an Exec Admin can change this.
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 notice notice-red">
          {error}
        </p>
      )}
    </section>
  );
}
