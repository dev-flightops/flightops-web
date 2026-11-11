"use client";

import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import type { ComplianceSettings } from "@/lib/api/type-qualifications";

import { setDrugAlcoholBlocksAction } from "./actions";

/**
 * The company's release switch for the program (Greg, 11 Nov): on, release
 * refuses a PIC or SIC who isn't cleared for safety-sensitive duty. Off to
 * start, so pilots hired before FlightOps aren't held until their tests are
 * entered. Two clicks, as the other release switches.
 */
export function ReleaseCard({
  settings,
  canChange,
}: {
  settings: ComplianceSettings;
  /** RELEASE_POLICY_ADMINS: the Director of Operations or an Exec Admin. */
  canChange: boolean;
}) {
  const on = Boolean(settings.drug_alcohol_blocks);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(blocks: boolean) {
    setError(null);
    startTransition(async () => {
      const outcome = await setDrugAlcoholBlocksAction(blocks);
      if (outcome.ok) setConfirming(false);
      else setError(outcome.message);
    });
  }

  const changed = settings.drug_alcohol_changed_at
    ? `${on ? "On" : "Off"} since ${settings.drug_alcohol_changed_at.slice(0, 10)}${
        settings.drug_alcohol_changed_by ? `, by ${settings.drug_alcohol_changed_by.full_name}` : ""
      }.`
    : "Off — never switched on.";

  return (
    <section aria-labelledby="dat-release-heading" className="mb-6 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <h2 id="dat-release-heading" className="panel-title">
            Hold the Release
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            On, release refuses a PIC or SIC who isn&rsquo;t cleared for safety-sensitive duty: no negative
            pre-employment drug test on file, or removed from duty. The dispatcher sees only that they aren&rsquo;t
            cleared, never why. Turn it on once everyone&rsquo;s tests are entered.
          </p>
          <p className="mt-2 text-xs">
            <span className={"status-mark mr-2 text-[0.65rem] " + (on ? "text-status-green" : "text-muted-foreground")}>
              {on ? "On" : "Off"}
            </span>
            <span className="text-muted-foreground">{changed}</span>
          </p>
        </div>

        {canChange ? (
          confirming ? (
            <span className="flex flex-wrap items-center gap-2 text-xs">
              {on ? "Turn off? Release stops checking." : "Turn on? Pilots who aren't cleared won't be released."}
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
