"use client";

import { useState, useTransition, type ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { UserRef } from "@/lib/api/types";
import type { FleetType } from "@/lib/fleet-types";

export type SaveTypesResult = { ok: true } | { ok: false; error: string };

/**
 * A company list of the fleet's aircraft types that a release rule
 * applies to: those whose PIC needs a first-class medical (#87), those
 * that are not IFR certified (#89). Ticked from the fleet's own types;
 * the whole list is saved at once.
 */
export function AircraftTypesCard({
  id,
  title,
  description,
  legend,
  saved,
  changedAt,
  changedBy,
  fleetTypes,
  canChange,
  save,
}: {
  id: string;
  title: string;
  description: ReactNode;
  /** What the checkboxes are, for a screen reader. */
  legend: string;
  saved: string[];
  changedAt: string | null | undefined;
  changedBy: UserRef | null | undefined;
  fleetTypes: FleetType[];
  /** RELEASE_POLICY_ADMINS: the Director of Operations or an Exec Admin. */
  canChange: boolean;
  save: (airframeTypes: string[]) => Promise<SaveTypesResult>;
}) {
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

  function submit() {
    setError(null);
    startTransition(async () => {
      const outcome = await save(chosen);
      if (!outcome.ok) setError(outcome.error);
    });
  }

  const changed = changedAt
    ? `Changed ${changedAt.slice(0, 10)}${changedBy ? `, by ${changedBy.full_name}` : ""}.`
    : "No aircraft chosen yet.";

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="mb-6 rounded-lg border border-border bg-card p-5"
    >
      <h2 id={`${id}-heading`} className="panel-title">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{description}</p>

      {shown.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No aircraft in the fleet carry a type yet.
        </p>
      ) : (
        <fieldset className="mt-3" disabled={!canChange || pending}>
          <legend className="sr-only">{legend}</legend>
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
            onClick={submit}
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
