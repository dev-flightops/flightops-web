"use client";

import { useState, useTransition } from "react";

import { signFratAction } from "@/app/(app)/frat/actions";
import { linkCaps } from "@/components/ff/controls";
import type { FratAssessmentResponse, FratSignRole, FratSignoff } from "@/lib/api/types";
import { pilotMinutesLine } from "@/lib/frat/signoff-text";
import { cn } from "@/lib/utils";

function when(iso: string, timeZone: string): string {
  const at = new Date(iso);
  const local = at.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
    timeZoneName: "short",
  });
  return `${local} (${at.toISOString().slice(11, 16)}Z)`;
}

const TITLES: Record<FratSignRole, string> = { pilot: "Pilot", dispatcher: "Dispatcher" };

/**
 * The FRAT's two sign-off boxes (#155), as the client specified on 10/29:
 * "the pilot and the dispatcher each check a sign-off box. Each check
 * records the person's name and the date/time ... The flight can't be
 * released until both have signed. If anyone edits the FRAT after a
 * signature, both signatures clear and both have to sign again."
 *
 * A box is checked once and stays checked for this FRAT: filing it again
 * makes a new FRAT with both boxes empty. Each signs the version on screen
 * (its id goes with the sign-off), so an edit made meanwhile is refused
 * rather than signed unread.
 */
export function FratSignoffs({
  flightId,
  frat,
  timeZone,
  canSign,
}: {
  flightId: string;
  frat: FratAssessmentResponse;
  /** The company's zone, for the times. */
  timeZone: string;
  /** Which box the viewer may check: the FRAT's pilot the pilot's, anyone
   *  who may release the dispatcher's. */
  canSign: Record<FratSignRole, boolean>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const signed = new Map((frat.signoffs ?? []).map((s) => [s.role, s] as const));
  const check = frat.verification ?? null;
  const locked = Boolean(frat.locked);

  const sign = (role: FratSignRole) => {
    setError(null);
    startTransition(async () => {
      const result = await signFratAction(flightId, frat.id, role);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <section aria-label="FRAT sign-off" className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <p className="eyebrow">Sign-off</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The pilot and a dispatcher each sign. Signing records your name and the time against this
          version of the FRAT; filing it again clears both.
        </p>
      </header>
      <ul className="divide-y divide-border">
        {(["pilot", "dispatcher"] as const).map((role) => {
          const s: FratSignoff | undefined = signed.get(role);
          const id = `frat-sign-${role}`;
          const disabled = Boolean(s) || !canSign[role] || locked || pending;
          return (
            <li key={role} className="flex items-start gap-3 px-5 py-3 text-sm">
              <input
                id={id}
                type="checkbox"
                checked={Boolean(s)}
                disabled={disabled}
                onChange={(e) => {
                  if (e.target.checked) sign(role);
                }}
                aria-label={`Sign the FRAT as the ${TITLES[role].toLowerCase()}`}
                className="mt-1 h-4 w-4 shrink-0 accent-status-green disabled:cursor-not-allowed"
              />
              <label htmlFor={id} className="min-w-0 flex-1">
                <span className="font-semibold text-foreground">{TITLES[role]}</span>{" "}
                {s ? (
                  <span className="text-foreground">{`signed by ${s.signer_name}, ${when(s.signed_at, timeZone)}`}</span>
                ) : (
                  <span className="text-muted-foreground">
                    {canSign[role] && !locked
                      ? "— check the box to sign"
                      : role === "pilot"
                        ? "— waiting for the pilot"
                        : "— waiting for a dispatcher"}
                  </span>
                )}
                {s && role === "pilot" ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {pilotMinutesLine(s.flight_minutes_today, s.flight_minutes_remaining)}
                  </span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
      {check?.complete ? (
        <div className="border-t border-border px-5 py-3 text-xs">
          <p className={check.intact ? "text-foreground" : "font-semibold text-status-red"}>
            {check.intact
              ? `Signed by both. Audit trail ID ${check.code}.`
              : "The FRAT no longer matches what was signed. File it again and sign it again."}
          </p>
          {check.intact ? (
            <p className="mt-0.5 break-all font-mono text-[0.65rem] text-muted-foreground">{`SHA-256 ${check.record_hash}`}</p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
        <a href={`/api/frat/${flightId}/pdf`} target="_blank" rel="noreferrer" className={linkCaps}>
          {check?.complete ? "Signed FRAT (PDF) ›" : "FRAT (PDF) ›"}
        </a>
        {pending ? <span className="text-xs text-muted-foreground">Signing…</span> : null}
      </div>
      {error ? (
        <p role="alert" className={cn("field-error px-5 pb-3")}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
