"use client";

import { useState } from "react";

/**
 * Duty In / Out hero button (Spec 4 §"Page layout / Duty In / Out button").
 *
 * UI placeholder for this PR. Phil's spec calls for a large blue DUTY IN
 * button when off-shift and a large red DUTY OUT button (with elapsed
 * time) when on-shift. The full backend — `timeclock` records, 9h min
 * rest, 14h max duty, missing-clock-out detection — lands in the
 * follow-up "Duty time tracking" PR.
 *
 * This component renders the right shape and toggles its local state on
 * click so the layout is reviewable end-to-end without the backend.
 * The follow-up will replace the local state with a server action that
 * writes to `timeclock` and refreshes the page.
 */
export function DutyClockButton() {
  const [onDuty, setOnDuty] = useState(false);

  if (onDuty) {
    return (
      <button
        type="button"
        onClick={() => setOnDuty(false)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-status-red/40 bg-status-red/10 px-5 py-4 transition-colors hover:bg-status-red/15"
        title="Duty backend ships in the next PR; this button is a UI preview."
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
          —:—
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOnDuty(true)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-status-blue/40 bg-status-blue/10 px-5 py-4 transition-colors hover:bg-status-blue/15"
      title="Duty backend ships in the next PR; this button is a UI preview."
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
