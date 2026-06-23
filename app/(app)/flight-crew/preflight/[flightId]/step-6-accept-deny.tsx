"use client";

import { useState, useTransition } from "react";

import type { PilotAcceptanceResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import {
  completeStepAction,
  submitPilotAcceptanceAction,
} from "./actions";

interface Props {
  flightId: string;
  /** Latest acceptance attempt for this (flight, pilot) — null if
   *  nothing submitted yet. When the latest row is `accepted=true`
   *  the Step 6 gate clears; on `accepted=false` we render the
   *  rejection banner + let the pilot re-attempt. */
  initial: PilotAcceptanceResponse | null;
}

const MIN_DENY_REASON_LENGTH = 20;

/**
 * Step 6 — Accept or Deny Release (Spec 4 §"The 8 steps / 6").
 *
 * Two large buttons. ACCEPT (green) logs permanently + dispatcher
 * is notified (notification fan-out ships with M3). DENY (red)
 * requires a reason ≥20 chars; dispatcher + CP are notified.
 *
 * After DENY:
 *   - Latest acceptance row has accepted=false + denied_reason
 *   - Step 6 gate stays open — pilot cannot proceed
 *   - Once dispatch resolves the issue, pilot re-submits with ACCEPT
 *
 * After ACCEPT:
 *   - Latest acceptance row has accepted=true
 *   - We call completeStepAction(flightId, 6, ...) to advance the
 *     preflight to Step 7
 */
export function AcceptOrDenyStep({ flightId, initial }: Props) {
  const [latest, setLatest] = useState<PilotAcceptanceResponse | null>(
    initial,
  );
  const [mode, setMode] = useState<"choose" | "deny">("choose");
  const [denyReason, setDenyReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isAccepted = latest?.accepted === true;
  const isDenied = latest && latest.accepted === false;

  const submit = (accepted: boolean, reason?: string) => {
    setError(null);
    startTransition(async () => {
      const result = await submitPilotAcceptanceAction(flightId, {
        accepted,
        denied_reason: accepted ? undefined : reason,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLatest(result.acceptance);
      // On accept, also advance the preflight step. On deny, leave
      // the gate open — pilot can resolve + re-submit.
      if (accepted) {
        const stepResult = await completeStepAction(flightId, 6, {
          acceptance_id: result.acceptance.id,
          accepted_at: result.acceptance.created_at,
        });
        if (!stepResult.ok) {
          setError(stepResult.error ?? "Recorded accept but couldn't advance step — refresh.");
        }
      } else {
        setMode("choose");
        setDenyReason("");
      }
    });
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Step 6
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Accept or Deny Release
        </h2>
      </header>

      <div className="space-y-4 px-5 py-4 text-sm">
        {isAccepted && (
          <div
            role="status"
            className="rounded-md border border-status-green/40 bg-status-green/10 px-3 py-3 text-xs text-status-green"
          >
            <p className="font-semibold uppercase tracking-[0.06em]">
              Release accepted
            </p>
            <p className="mt-1 text-foreground">
              Logged at {formatUtcDate(latest!.created_at)}. Dispatcher has
              been notified.
            </p>
          </div>
        )}

        {isDenied && (
          <div
            role="alert"
            className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-3 text-xs text-status-red"
          >
            <p className="font-semibold uppercase tracking-[0.06em]">
              Release denied
            </p>
            <p className="mt-1 text-foreground">
              You denied this release at {formatUtcDate(latest!.created_at)}.
              Dispatcher and Chief Pilot have been notified. Once the issue
              is resolved, re-submit by tapping ACCEPT below.
            </p>
            <p className="mt-2 whitespace-pre-wrap rounded-md border border-status-red/40 bg-background px-2 py-1.5 text-foreground">
              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-red">
                Your reason
              </span>
              <br />
              {latest!.denied_reason}
            </p>
          </div>
        )}

        {!isAccepted && (
          <p className="text-muted-foreground">
            By accepting you confirm you reviewed the dispatch release and
            you are prepared to fly. By denying you flag a blocking issue
            for dispatch and Chief Pilot — preflight cannot advance until
            it's resolved.
          </p>
        )}

        {mode === "choose" && !isAccepted && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => submit(true)}
              className="rounded-md border-2 border-status-green/40 bg-status-green/10 px-4 py-4 text-base font-bold uppercase tracking-[0.04em] text-status-green transition-colors hover:bg-status-green/15 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Accept release"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode("deny")}
              className="rounded-md border-2 border-status-red/40 bg-status-red/10 px-4 py-4 text-base font-bold uppercase tracking-[0.04em] text-status-red transition-colors hover:bg-status-red/15 disabled:opacity-50"
            >
              Deny release
            </button>
          </div>
        )}

        {mode === "deny" && (
          <DenyForm
            value={denyReason}
            onChange={setDenyReason}
            disabled={pending}
            onCancel={() => {
              setMode("choose");
              setDenyReason("");
              setError(null);
            }}
            onSubmit={() => submit(false, denyReason)}
          />
        )}

        {error && (
          <p role="alert" className="text-xs text-status-red">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function DenyForm({
  value,
  onChange,
  onCancel,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const trimmedLen = value.trim().length;
  const canSubmit = trimmedLen >= MIN_DENY_REASON_LENGTH && !disabled;
  return (
    <div className="space-y-2 rounded-md border border-status-red/40 bg-status-red/5 px-3 py-3 text-xs">
      <p className="font-semibold uppercase tracking-[0.06em] text-status-red">
        Reason for denial
      </p>
      <p className="text-foreground">
        Required ≥ {MIN_DENY_REASON_LENGTH} characters. Dispatcher + Chief
        Pilot see this verbatim. Be specific about what needs to change
        before you'll accept.
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Open MEL on N207GE — need MX sign-off before I'll accept."
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-status-red focus:outline-none"
      />
      <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground">
        <span>
          {trimmedLen}/{MIN_DENY_REASON_LENGTH} minimum
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="rounded-md border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-card/80 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            className={cn(
              "rounded-md border-2 border-status-red/40 bg-status-red/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.04em] text-status-red transition-colors hover:bg-status-red/20",
              !canSubmit && "opacity-50",
            )}
          >
            {disabled ? "Saving…" : "Submit deny"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatUtcDate(iso: string): string {
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}Z`;
}
