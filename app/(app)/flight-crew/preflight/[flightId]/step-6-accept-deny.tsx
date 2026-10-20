"use client";

import { useState, useTransition } from "react";

import { buttonOutline } from "@/components/ff/controls";
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

  /** Complete step 6 against an acceptance that is already recorded.
   *
   *  Used by the normal accept path and by the Continue button on the
   *  accepted panel, which is what recovers a half-written accept. */
  const advanceAfterAccept = (acceptance = latest) => {
    if (!acceptance) return;
    setError(null);
    startTransition(async () => {
      const stepResult = await completeStepAction(flightId, 6, {
        acceptance_id: acceptance.id,
        accepted_at: acceptance.created_at,
      });
      if (!stepResult.ok) {
        setError(
          stepResult.error ??
            "Couldn't record this step. Try Continue again.",
        );
      }
    });
  };

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
          // Not "refresh": refreshing lands back on the accepted panel.
          // Continue there retries this same write.
          setError(
            stepResult.error ??
              "Your accept is recorded but the step didn't advance. Press Continue to finish it.",
          );
        }
      } else {
        setMode("choose");
        setDenyReason("");
      }
    });
  };

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <p className="eyebrow">Step 6</p>
        <h2 className="caption-caps mt-1 text-lg text-foreground">Accept or Deny Release</h2>
      </header>

      <div className="space-y-4 px-5 py-4 text-sm">
        {isAccepted && (
          <div
            role="status"
            className="notice notice-green"
          >
            <p className="notice-label">Release accepted</p>
            <p className="mt-1 text-foreground">
              Logged at {formatUtcDate(latest!.created_at)}. Dispatcher has
              been notified.
            </p>
            {/* Recovery for a half-written accept, and the only way out
                of it.

                Accepting is two writes that are not atomic: record the
                acceptance, then complete step 6. If the second fails —
                a blip, a 500, a session expiring in between — the
                acceptance exists and the step does not, and the code
                said "Recorded accept but couldn't advance step —
                refresh." Refreshing cannot fix it: on reload the
                acceptance is found, this accepted panel renders, and
                before this button there was nothing on it to press. No
                Continue, no retry, no Edit (step 6 was never completed,
                so it never appeared in the completed list). The
                preflight was bricked and the advice was the one thing
                that does not work.

                Reaching this panel as the ACTIVE step means step 6 is
                not complete — the shell would render step 7 otherwise —
                so the button is always the right thing to offer here.
                In the normal flow accepting advances on its own and
                this is never seen. */}
            <button
              type="button"
              onClick={() => advanceAfterAccept()}
              disabled={pending}
              className="btn-caps mt-2.5 rounded-md bg-primary px-3 py-1.5 text-white hover:bg-brand-dark disabled:opacity-50 text-[0.72rem]"
            >
              {pending ? "Recording…" : "Continue to Step 7 →"}
            </button>
          </div>
        )}

        {isDenied && (
          <div
            role="alert"
            className="notice notice-red"
          >
            <p className="notice-label">Release denied</p>
            <p className="mt-1 text-foreground">
              You denied this release at {formatUtcDate(latest!.created_at)}.
              Dispatcher and Chief Pilot have been notified. Once the issue
              is resolved, re-submit by tapping ACCEPT below.
            </p>
            <p className="mt-2 whitespace-pre-wrap border-l-2 border-status-red/60 pl-2.5 text-foreground">
              <span className="eyebrow">Your reason</span>
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
              className="btn-caps rounded-md bg-status-green-fill px-4 py-4 text-white transition hover:brightness-95 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Accept release"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode("deny")}
              className="btn-caps rounded-md border border-status-red/60 px-4 py-4 text-status-red transition-colors hover:border-status-red hover:bg-accent/40 disabled:opacity-50"
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
          <p role="alert" className="field-error">
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
    <div className="notice notice-red space-y-2 text-xs">
      <p className="notice-label">Reason for denial</p>
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
        className="ff-input px-2 py-1.5 text-xs focus:border-status-red"
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
            className={cn(buttonOutline, "px-3 py-1 text-[0.68rem]")}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            className={cn(
              "btn-caps rounded-md bg-status-red-fill px-3 py-1 text-[0.68rem] text-white transition hover:brightness-95",
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
