"use client";

import { useEffect, useState, useTransition } from "react";

import { buttonOutline } from "@/components/ff/controls";
import type { CurrentDutyResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { resumeNote, useArmedConfirm } from "@/components/duty/confirm-duty-out";

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
  // Set when a clock-in reopened the duty day, so the pilot is told why
  // the clock reads the whole day rather than zero.
  const [resumedSince, setResumedSince] = useState<string | null>(null);
  // useState(initial) keeps its first value; after the action
  // revalidates, the server's snapshot has to replace the optimistic
  // one (a temp id and 0h, where a resumed day is hours in).
  useEffect(() => {
    setDuty(initial);
  }, [initial]);

  const isOnDuty = duty.open !== null;
  const { armed, arm, disarm, ref } = useArmedConfirm();

  const handleClick = () => {
    setError(null);
    setResumedSince(null);

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
      } else if (result.resumed && result.clockInAt) {
        setResumedSince(result.clockInAt);
      }
    });
  };

  // One quiet row, its state on a 3px left edge (#81): brand when off
  // duty, red while on duty. The whole row stays the button, so the
  // pilot's tap target is as wide as the page ("easy start stop button",
  // the client, 8/28). The elapsed time reads as a figure, as the
  // Flight Following stats show theirs.
  const row =
    "flex w-full items-center justify-between gap-4 rounded-lg border border-border border-l-[3px] bg-card px-5 py-4 text-left transition-colors hover:bg-accent disabled:opacity-60";

  return (
    <div className="space-y-2" ref={ref}>
      {isOnDuty && duty.open && armed ? (
        /* Armed. The elapsed time and the consequence are both on
           screen, because "are you sure?" on its own does not tell a
           pilot anything they did not already know. */
        <div className="rounded-lg border border-border border-l-[3px] border-l-status-red bg-card px-5 py-4">
          <p className="font-display text-xl font-extrabold tracking-[0.03em] text-foreground">
            CLOSE THIS DUTY PERIOD?
          </p>
          <p className="mt-1 text-xs text-foreground">
            You have been on duty{" "}
            <span className="font-mono font-semibold">
              {formatElapsed(duty.open.elapsed_hours)}
            </span>
            . {resumeNote(duty.min_rest_hours)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={disarm} className={cn(buttonOutline, "px-3 py-1.5")}>
              Keep working
            </button>
            <button
              type="button"
              onClick={handleClick}
              disabled={pending}
              className="btn-caps rounded-md bg-status-red-fill px-3 py-1.5 text-[0.72rem] text-white hover:brightness-95 disabled:opacity-60"
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
          className={cn(row, "border-l-status-red")}
        >
          <span className="flex flex-col items-start">
            <span className="font-display text-xl font-extrabold tracking-[0.03em] text-foreground">
              DUTY OUT
            </span>
            <span className="mt-0.5 text-[0.75rem] text-muted-foreground">
              Currently on duty — tap, then confirm
            </span>
          </span>
          <span className="flex flex-col items-end">
            <span className="status-mark text-status-red">On duty</span>
            <span className="mt-1 font-display text-2xl font-extrabold leading-none tabular-nums text-foreground">
              {formatElapsed(duty.open.elapsed_hours)}
            </span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className={cn(row, "border-l-primary")}
        >
          <span className="flex flex-col items-start">
            <span className="font-display text-xl font-extrabold tracking-[0.03em] text-foreground">
              DUTY IN
            </span>
            <span className="mt-0.5 text-[0.75rem] text-muted-foreground">
              Off duty — tap to start your day
            </span>
          </span>
          <span className="status-mark text-muted-foreground">Off duty</span>
        </button>
      )}

      {duty.warnings.length > 0 && (
        <ul className="space-y-2">
          {duty.warnings.map((w, i) => (
            <li
              key={i}
              className={cn("notice text-xs", w.level === "red" ? "notice-red" : "notice-yellow")}
            >
              <span className="notice-label">{w.level === "red" ? "WARNING" : "Heads up"}</span>
              {w.message}
            </li>
          ))}
        </ul>
      )}

      {resumedSince && (
        <p role="status" className="text-xs text-foreground">
          Duty day resumed — on duty since{" "}
          <span className="font-mono font-semibold">
            {new Date(resumedSince).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </span>
          . You were back inside the {duty.min_rest_hours}h minimum rest, so
          the break counts as duty.
        </p>
      )}

      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

function formatElapsed(hours: number): string {
  const wholeHours = Math.floor(hours);
  const mins = Math.round((hours - wholeHours) * 60);
  return `${wholeHours}h ${String(mins).padStart(2, "0")}m`;
}
