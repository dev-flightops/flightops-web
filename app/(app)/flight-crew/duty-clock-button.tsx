"use client";

import { useState, useTransition } from "react";

import type { CurrentDutyResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

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

  const handleClick = () => {
    setError(null);

    if (isOnDuty) {
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
    <div className="space-y-2">
      {isOnDuty && duty.open ? (
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
                Currently on duty — tap to close
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
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-status-blue/40 bg-status-blue/10 px-5 py-4 transition-colors hover:bg-status-blue/15 disabled:opacity-60"
        >
          <span className="flex items-center gap-3">
            <ClockIcon className="h-6 w-6 text-status-blue" />
            <span className="flex flex-col items-start">
              <span className="text-base font-bold tracking-wide text-status-blue">
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
