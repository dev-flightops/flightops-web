"use client";

import { useState } from "react";

import { DateTimeWheel } from "@/components/ui/date-time-wheel";
import type { DutyPeriodSummary } from "@/lib/api/types";

import {
  amendDutyAction,
  type AmendState,
} from "@/app/(app)/time-clock/actions";

/**
 * Correcting a duty period by hand.
 *
 * Client bug report 8/28:
 *
 *   We need an ability to manually adjust duty in and duty out time.
 *   If you forget to log out there's no way to pilot override the
 *   function. So I'd say, easy start stop button, but manual
 *   clock/date function underneath.
 *
 * Which is what this is: the button stays the primary way in, and the
 * manual times sit underneath it, folded away until wanted. A form
 * that is open by default invites hand-editing as the normal route,
 * and the clock is the normal route.
 *
 * Date and time together, because a duty period spans midnight often
 * enough that a time-only field would need the reader to work out which
 * day they meant, and the reported case — forgetting to clock out — is
 * precisely the one where the answer is "yesterday". As scrolling
 * wheels since the client asked for them, 27 Sep: "We also simply need
 * a scrolling wheel with date and time to manually adjust our duty
 * day." They were datetime-local inputs, which render differently on
 * every device and want typing on a phone.
 *
 * A reason is required. This is an amendment to a record the 135.267
 * limits are computed from, and one with no stated reason is the one
 * an inspector asks about. The server requires it too; this asks
 * first so the round trip is not wasted.
 *
 * Shared rather than owned by /time-clock, because of the follow-up on
 * 9/17:
 *
 *   Manual duty time history works on admin side. Individual pilot
 *   role doesn't see the HR portal and isn't able to change their duty
 *   time. Ideally, it would be under the flight crew duty module,
 *   pilot history, duty time.
 *
 * The control was only ever rendered on /time-clock, which sits in the
 * HR department and is not in a pilot's navigation. So the one person
 * the 8/28 change was built for — a pilot who forgot to clock out —
 * could not reach it. The backend was never the problem: ops-service
 * has scoped amendments to `DutyPeriod.user_id == current_user_id()`
 * from the start, with the docstring "A pilot may amend their own
 * periods". Only the UI was missing from where a pilot stands.
 */

/** Corrections reach this far back: ops-service AMENDMENT_WINDOW_DAYS. */
const WINDOW_DAYS = 30;

/** The same instant, to the minute: what the wheels can express. */
function toMinute(iso: string): Date {
  const d = new Date(iso);
  d.setSeconds(0, 0);
  return d;
}

export function CorrectDuty({
  period,
  triggerLabel = "Correct",
}: {
  period: DutyPeriodSummary;
  /** "Correct" on a history row; "Adjust duty times" under the button. */
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [clockIn, setClockIn] = useState(() => toMinute(period.clock_in_at));
  const [clockOut, setClockOut] = useState<Date | null>(() =>
    period.clock_out_at ? toMinute(period.clock_out_at) : null,
  );
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<AmendState>({ status: "idle" });

  const originalIn = toMinute(period.clock_in_at).getTime();
  const originalOut = period.clock_out_at
    ? toMinute(period.clock_out_at).getTime()
    : null;
  const earliest = new Date(now.getTime() - WINDOW_DAYS * 24 * 3600 * 1000);

  function start() {
    // Fresh bounds and values each time it opens: the period may have
    // moved on since the page rendered.
    const current = new Date();
    setNow(current);
    setClockIn(toMinute(period.clock_in_at));
    setClockOut(period.clock_out_at ? toMinute(period.clock_out_at) : null);
    setState({ status: "idle" });
    setOpen(true);
  }

  async function submit() {
    setPending(true);
    setState({ status: "idle" });
    const result = await amendDutyAction(
      period.id,
      // Only send what actually changed, so an untouched field is not
      // rewritten with the same value and logged as an amendment.
      clockIn.getTime() !== originalIn ? clockIn.toISOString() : null,
      clockOut !== null && clockOut.getTime() !== originalOut
        ? clockOut.toISOString()
        : null,
      reason,
    );
    setState(result);
    setPending(false);
    if (result.status === "ok") setOpen(false);
  }

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={start}
          className="text-[0.65rem] font-semibold text-primary hover:underline"
        >
          {triggerLabel}
        </button>
        {state.status === "ok" ? (
          <span role="status" className="ml-2 text-[0.65rem] text-status-green">
            {state.message}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <form
      aria-label="Correct duty times"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="mt-2 space-y-3 rounded-md border border-border bg-background p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DateTimeWheel
          label="Duty in"
          value={clockIn}
          onChange={setClockIn}
          earliest={earliest}
          latest={now}
        />
        {clockOut !== null ? (
          <div>
            <DateTimeWheel
              label="Duty out"
              value={clockOut}
              onChange={setClockOut}
              earliest={earliest}
              latest={now}
            />
            {originalOut === null && (
              <button
                type="button"
                onClick={() => setClockOut(null)}
                className="mt-1 text-[0.65rem] font-semibold text-muted-foreground hover:text-foreground"
              >
                Still on duty — no duty-out time
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col justify-center gap-1 rounded-md border border-dashed border-border p-3">
            <p className="text-xs text-muted-foreground">Still on duty.</p>
            <button
              type="button"
              onClick={() => setClockOut(new Date(now))}
              className="self-start text-[0.65rem] font-semibold text-primary hover:underline"
            >
              Add a duty-out time
            </button>
          </div>
        )}
      </div>

      <label className="block text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
        Why
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="e.g. forgot to clock out at end of shift"
          className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-foreground"
        />
      </label>

      {state.status === "error" ? (
        <p role="alert" className="text-[0.65rem] text-status-red">
          {state.message}
        </p>
      ) : null}

      {/* Said plainly rather than in the small print. A pilot amending
          their own duty record should know it is kept, not discover it
          later. */}
      <p className="text-[0.65rem] text-muted-foreground">
        The original times and your reason are kept with the record.
      </p>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || !reason.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-[0.65rem] font-semibold text-primary-foreground hover:bg-brand-dark disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save correction"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[0.65rem] font-semibold text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
