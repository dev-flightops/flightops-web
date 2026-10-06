"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { ComplianceSettings } from "@/lib/api/type-qualifications";

import { setTypeQualificationGateAction } from "./actions";

/**
 * Aircraft qualifications at release (#46): the company switch.
 *
 * Off by default (Greg, 6 Oct 2026). At rollout no pilot holds a type
 * authorisation, so a gate that was always on would refuse every
 * release until the grid was entered. Turning it on is a two-step
 * click because it changes what every dispatcher may release.
 */
export function TypeGateCard({
  settings,
  canChange,
}: {
  settings: ComplianceSettings;
  /** RELEASE_POLICY_ADMINS: the Director of Operations or an Exec Admin. */
  canChange: boolean;
}) {
  const on = settings.enforce_type_qualifications;
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(enforce: boolean) {
    setError(null);
    startTransition(async () => {
      const outcome = await setTypeQualificationGateAction(enforce);
      if (outcome.ok) setConfirming(false);
      else setError(outcome.error);
    });
  }

  const changed = settings.type_qualifications_changed_at
    ? `${on ? "On" : "Off"} since ${settings.type_qualifications_changed_at.slice(0, 10)}${
        settings.type_qualifications_changed_by
          ? `, by ${settings.type_qualifications_changed_by.full_name}`
          : ""
      }.`
    : on
      ? "On."
      : "Off — never switched on.";

  return (
    <section
      aria-labelledby="type-gate-heading"
      className="mb-6 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <h2 id="type-gate-heading" className="text-sm font-bold tracking-tight">
            Aircraft qualifications at release
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            When on, release is refused for a PIC who isn&rsquo;t current as PIC on the
            aircraft&rsquo;s type. A Chief Pilot, Director of Operations or Exec Admin
            can override it for one flight, as for a currency block. The crew panel and
            the crew calendar flag pilots who aren&rsquo;t current on the type. Leave it
            off until every pilot&rsquo;s positions and check rides are entered on the{" "}
            <Link href="/compliance/type-qualifications" className="font-semibold text-primary hover:underline">
              aircraft qualifications
            </Link>{" "}
            page.
          </p>
          <p className="mt-2 text-xs">
            <span
              className={
                "mr-2 rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] " +
                (on ? "bg-status-green/15 text-status-green" : "bg-muted text-muted-foreground")
              }
            >
              {on ? "On" : "Off"}
            </span>
            <span className="text-muted-foreground">{changed}</span>
          </p>
        </div>

        {canChange ? (
          confirming ? (
            <span className="flex flex-wrap items-center gap-2 text-xs">
              {on
                ? "Turn off? Release stops checking the type."
                : "Turn on? Releases for a PIC not current on the type will be refused."}
              <button
                type="button"
                onClick={() => change(!on)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground hover:bg-brand-dark disabled:opacity-60"
              >
                {pending && <Spinner size="xs" />}
                {on ? "Turn off" : "Turn on"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded-md border border-border px-3 py-1.5 font-semibold"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
            >
              {on ? "Turn off…" : "Turn on…"}
            </button>
          )
        ) : (
          <p className="max-w-[14rem] text-xs text-muted-foreground">
            The Director of Operations or an Exec Admin can change this.
          </p>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {error}
        </p>
      )}
    </section>
  );
}
