"use client";

import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import type { ComplianceSettings } from "@/lib/api/type-qualifications";

import { setNotStartedBlocksAction } from "./actions";

/**
 * Records never entered (#99, #91). The compliance board showed "Not
 * started" for an item nobody had logged while release treated the pilot
 * as current. Decided 26 Oct: a record never entered warns, until the
 * company's records are in; then this switch makes it block, and such a
 * pilot isn't offered for the seat. Approach and landing counts come from
 * the flight logs and are left out. Two clicks, as the type check's.
 */
export function NotStartedCard({
  settings,
  canChange,
}: {
  settings: ComplianceSettings;
  /** RELEASE_POLICY_ADMINS: the Director of Operations or an Exec Admin. */
  canChange: boolean;
}) {
  const on = Boolean(settings.not_started_blocks);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(blocks: boolean) {
    setError(null);
    startTransition(async () => {
      const outcome = await setNotStartedBlocksAction(blocks);
      if (outcome.ok) setConfirming(false);
      else setError(outcome.error);
    });
  }

  const changed = settings.not_started_changed_at
    ? `${on ? "On" : "Off"} since ${settings.not_started_changed_at.slice(0, 10)}${
        settings.not_started_changed_by ? `, by ${settings.not_started_changed_by.full_name}` : ""
      }.`
    : "Off — never switched on.";

  return (
    <section aria-labelledby="not-started-heading" className="mb-6 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <h2 id="not-started-heading" className="panel-title">
            Records never entered
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            A currency item nobody has entered for a pilot shows as Not started. Off, it is a
            warning the dispatcher acknowledges at release. On, it blocks like an expired item:
            the pilot isn&rsquo;t offered for the seat and release is refused until the record is
            entered. Turn it on once every pilot&rsquo;s records are in. Approach and landing
            counts come from the flight logs and are left out.
          </p>
          <p className="mt-2 text-xs">
            <span
              className={
                "status-mark mr-2 text-[0.65rem] " + (on ? "text-status-green" : "text-muted-foreground")
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
                ? "Turn off? A record never entered goes back to a warning."
                : "Turn on? Pilots with a record never entered won't be offered or released."}
              <button type="button" onClick={() => change(!on)} disabled={pending} className={buttonSolid}>
                {on ? "Turn off" : "Turn on"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={buttonOutline}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={buttonOutline}>
              {on ? "Turn off…" : "Turn on…"}
            </button>
          )
        ) : (
          <p className="max-w-[14rem] text-xs text-muted-foreground">
            The Director of Operations or an Exec Admin can change this.
          </p>
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-3 notice notice-red">
          {error}
        </p>
      ) : null}
    </section>
  );
}
