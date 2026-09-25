"use client";

import { useState, useTransition } from "react";

import type { CurrentDutyResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import {
  NEW_PERIOD_WARNING,
  useArmedConfirm,
} from "@/components/duty/confirm-duty-out";

import { clockInAction, clockOutAction } from "./actions";

interface Props {
  initial: CurrentDutyResponse;
}

/**
 * Duty In / Out hero button + warnings strip (Spec 4 §"Page layout /
 * Duty In / Out button" + §"Duty time tracking").
 *
 * - When off-duty (`initial.open === null`): blue DUTY IN button.
 *   Clicking calls `clockInAction()` which writes a new duty period.
 * - When on-duty (`initial.open` is present): red DUTY OUT button with
 *   elapsed hours. Clicking calls `clockOutAction()` which closes the
 *   open period.
 * - Server `warnings` (from `_compute_warnings` in ops-service) render
 *   inline beneath the button — yellow + red, in the order the
 *   backend returned them.
 *
 * The button uses optimistic UI: the local state flips immediately so
 * the click feels responsive; on action failure we roll back + show
 * the error inline. The server action also calls `revalidatePath`, so
 * a successful click re-fetches the full duty state on the next
 * navigation/refresh.
 */
export function DutyClockButton({ initial }: Props) {
  const [duty, setDuty] = useState<CurrentDutyResponse>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isOnDuty = duty.open !== null;
  const { armed, arm, disarm, ref } = useArmedConfirm();

  const handleClick = () => {
    setError(null);

    if (isOnDuty) {
      // Asked first. What an accidental close costs is in
      // NEW_PERIOD_WARNING and the hook's comment: a split duty record
      // that reads as two legal short days.
      if (!armed) {
        arm();
        return;
      }
      disarm();
      // Optimistic: immediately close the open period locally.
      const closedShape = {
        ...duty,
        open: null,
        last_closed: duty.open,
        warnings: [],
      };
      const previous = duty;
      setDuty(closedShape);
      startTransition(async () => {
        const result = await clockOutAction();
        if (!result.ok) {
          setDuty(previous);
          setError(result.error ?? "Couldn't clock out.");
        }
      });
      return;
    }

    // Clock in — we don't know the assigned id until the action returns,
    // but the page revalidates so the next render replaces this temp.
    const tempOpen = {
      id: "temp",
      clock_in_at: new Date().toISOString(),
      clock_out_at: null,
      elapsed_hours: 0,
      is_open: true,
      rest_acknowledged: false,
    };
    const previous = duty;
    setDuty({ ...duty, open: tempOpen });
    startTransition(async () => {
      const result = await clockInAction();
      if (!result.ok) {
        setDuty(previous);
        setError(result.error ?? "Couldn't clock in.");
      }
    });
  };

  return (
    <div className="space-y-2" ref={ref}>
      {isOnDuty && duty.open && armed ? (
        /* Armed. The elapsed time and the consequence are both on
           screen, because "are you sure?" on its own does not tell a
           pilot anything they did not already know. */
        <div className="rounded-xl border border-status-red/50 bg-status-red/10 px-5 py-4">
          <p className="text-base font-bold tracking-wide text-status-red">
            CLOSE THIS DUTY PERIOD?
          </p>
          <p className="mt-1 text-xs text-foreground">
            You have been on duty{" "}
            <span className="font-mono font-semibold">
              {formatElapsed(duty.open.elapsed_hours)}
            </span>
            . {NEW_PERIOD_WARNING}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={disarm}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-card"
            >
              Keep working
            </button>
            <button
              type="button"
              onClick={handleClick}
              disabled={pending}
              className="rounded-md bg-status-red px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {pending ? "Closing…" : "Close duty period"}
            </button>
          </div>
        </div>
      ) : isOnDuty && duty.open ? (
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-status-red/40 bg-status-red/10 px-5 py-4 transition-colors hover:bg-status-red/15 disabled:opacity-60"
        >
          <span className="flex items-center gap-3">
            <ClockIcon className="h-6 w-6 text-status-red" />
            <span className="flex flex-col items-start">
              <span className="text-base font-bold tracking-wide text-status-red">
                DUTY OUT
              </span>
              <span className="text-[0.7rem] text-muted-foreground">
                Currently on duty — tap, then confirm
              </span>
            </span>
          </span>
          <span className="font-mono text-sm font-semibold text-status-red">
            {formatElapsed(duty.open.elapsed_hours)}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 px-5 py-4 transition-colors hover:bg-primary/15 disabled:opacity-60"
        >
          <span className="flex items-center gap-3">
            <ClockIcon className="h-6 w-6 text-primary" />
            <span className="flex flex-col items-start">
              <span className="text-base font-bold tracking-wide text-primary">
                DUTY IN
              </span>
              <span className="text-[0.7rem] text-muted-foreground">
                Off duty — tap to start your day
              </span>
            </span>
          </span>
        </button>
      )}

      {duty.warnings.length > 0 && (
        <ul className="space-y-1">
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
              </span>
              <span className="ml-2 text-foreground/90">{w.message}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-xs text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  );
}

function formatElapsed(hours: number): string {
  const wholeHours = Math.floor(hours);
  const mins = Math.round((hours - wholeHours) * 60);
  return `${wholeHours}h ${String(mins).padStart(2, "0")}m`;
}
