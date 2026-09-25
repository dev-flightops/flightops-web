"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { CurrentDutyResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { clockInAction } from "../../actions";
import { completeStepAction } from "./actions";

interface Props {
  flightId: string;
  duty: CurrentDutyResponse;
}

/**
 * Step 5 — Duty In Confirmation (Spec 4 §"The 8 steps / 5").
 *
 * Reads the already-live /ops/duty/current — no new backend. Surfaces
 * the same warning math the dispatcher sees on the packet:
 *
 *   - If pilot is NOT clocked in: a Duty In button, here on the step.
 *
 *     This used to be a link to /flight-crew plus "then refresh this
 *     page to continue", on the stated grounds that "we can't duplicate
 *     the duty button here without a separate refresh flow". Walking
 *     the sequence on 23 Sep showed what that cost: step 5 is a dead
 *     stop in the middle of a preflight that sends the pilot to another
 *     page and asks them to reload. Both halves of the instruction were
 *     also wrong by then — the top bar's Clock In works from this
 *     screen, and the step updates itself when it succeeds.
 *
 *     router.refresh() is the separate refresh flow, and it is one
 *     line. The pilot clocks in without leaving the step.
 *   - If clocked in with no warnings: green check + Continue.
 *   - If clocked in but warnings[] is non-empty: render each warning
 *     + require a rest_acknowledged checkbox before Continue.
 *
 * Spec 4 also calls out "Last rest period duration, total duty hours
 * today, hours remaining before limit." We surface min_rest_hours +
 * max_duty_hours from the response so the operator's tenant config
 * is visible.
 */
export function DutyInConfirmStep({ flightId, duty }: Props) {
  const isClockedIn = duty.open !== null;
  const hasWarnings = duty.warnings.length > 0;

  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const [clockingIn, setClockingIn] = useState(false);
  const [clockInError, setClockInError] = useState<string | null>(null);

  /** Clock in from the step, then re-render it with the open period.
   *
   *  clockInAction revalidates /flight-crew, not this route, so the
   *  refresh is what brings the new duty state back here. That gap is
   *  the whole reason the step used to tell the pilot to reload. */
  const handleClockIn = () => {
    setClockInError(null);
    setClockingIn(true);
    startTransition(async () => {
      const result = await clockInAction();
      setClockingIn(false);
      if (result.ok) {
        router.refresh();
      } else {
        // DutyActionResult.error is optional; a failure with no message
        // still has to say something rather than render blank.
        setClockInError(result.error ?? "Couldn't clock in. Try again.");
      }
    });
  };

  const canSubmit =
    isClockedIn && (!hasWarnings || acknowledged) && !pending;

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeStepAction(flightId, 5, {
        duty_period_id: duty.open?.id ?? null,
        elapsed_hours: duty.open?.elapsed_hours ?? null,
        warnings_acknowledged: hasWarnings ? acknowledged : false,
        // Snapshot the warnings the pilot saw — if rest math changes
        // later, the audit row still reflects what they accepted.
        warnings_snapshot: duty.warnings,
      });
      if (!result.ok) setError(result.error ?? "Couldn't continue.");
    });
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Step 5
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Duty In Confirmation
        </h2>
      </header>

      <div className="space-y-4 px-5 py-4 text-sm">
        {!isClockedIn ? (
          <div
            role="alert"
            className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-3 text-xs text-status-red"
          >
            <p className="font-semibold uppercase tracking-[0.06em]">
              Not clocked in
            </p>
            <p className="mt-1 text-foreground">
              A duty period has to be open before this leg can be
              signed off — it is what the 135.267 limits are measured
              against.
            </p>
            <button
              type="button"
              onClick={handleClockIn}
              disabled={clockingIn}
              className="mt-2.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {clockingIn ? "Clocking in…" : "Duty in"}
            </button>
            {/* No role="alert" of its own — the callout around it is
                already one, and nesting two makes the page announce
                twice and breaks getByRole("alert") for anything trying
                to read a single message. */}
            {clockInError ? (
              <p className="mt-2 font-semibold text-foreground">
                {clockInError}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-background px-4 py-3 text-xs">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                <Item
                  label="Clocked in"
                  value={duty.open ? formatUtcDate(duty.open.clock_in_at) : "—"}
                />
                <Item
                  label="Elapsed"
                  value={
                    duty.open ? formatElapsed(duty.open.elapsed_hours) : "—"
                  }
                />
                <Item
                  label="Min rest (tenant)"
                  value={`${duty.min_rest_hours.toFixed(1)} h`}
                />
                <Item
                  label="Max duty (tenant)"
                  value={`${duty.max_duty_hours.toFixed(1)} h`}
                />
              </dl>
            </div>

            {hasWarnings ? (
              <ul className="space-y-1.5">
                {duty.warnings.map((w, i) => (
                  <li
                    key={i}
                    className={cn(
                      "rounded-md border px-3 py-2 text-xs",
                      w.level === "red"
                        ? "border-status-red/40 bg-status-red/10 text-status-red"
                        : "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
                    )}
                  >
                    <span className="font-semibold uppercase tracking-[0.06em]">
                      {w.level === "red" ? "WARNING" : "Heads up"}
                    </span>{" "}
                    <span className="text-foreground">{w.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green">
                ✓ No rest or duty-limit warnings. Cleared to proceed.
              </p>
            )}

            {hasWarnings && (
              <label className="flex items-start gap-2 rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
                />
                <span>
                  I acknowledge the rest / duty warnings above and accept
                  the operational impact.
                </span>
              </label>
            )}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:bg-brand-dark disabled:opacity-50"
            >
              {pending ? "Saving…" : "Continue to Step 6 →"}
            </button>

            {error && (
              <p role="alert" className="text-xs text-status-red">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className="m-0 font-mono text-foreground">{value}</dd>
    </div>
  );
}

function formatUtcDate(iso: string): string {
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}Z`;
}

function formatElapsed(hours: number): string {
  const whole = Math.floor(hours);
  const mins = Math.round((hours - whole) * 60);
  return `${whole}h ${String(mins).padStart(2, "0")}m`;
}
