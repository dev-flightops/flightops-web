"use client";

import { useState } from "react";

import type { DutyPeriodSummary } from "@/lib/api/types";

import { amendDutyAction, type AmendState } from "./actions";

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
 * The datetime-local input is deliberate. A duty period spans midnight
 * often enough that a time-only field would need the reader to work
 * out which day they meant, and the reported case — forgetting to
 * clock out — is precisely the one where the answer is "yesterday".
 *
 * A reason is required. This is an amendment to a record the 135.267
 * limits are computed from, and one with no stated reason is the one
 * an inspector asks about. The server requires it too; this asks
 * first so the round trip is not wasted.
 */

/** A UTC instant as the value a datetime-local input wants — local
 *  wall-clock, no zone suffix. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Back the other way. The input has no zone, so it is read as local
 *  time and converted — which is what the pilot meant when they typed
 *  the hour they went off duty. */
function toIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function CorrectDuty({ period }: { period: DutyPeriodSummary }) {
  const [open, setOpen] = useState(false);
  const [clockIn, setClockIn] = useState(toLocalInput(period.clock_in_at));
  const [clockOut, setClockOut] = useState(toLocalInput(period.clock_out_at));
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<AmendState>({ status: "idle" });

  const originalIn = toLocalInput(period.clock_in_at);
  const originalOut = toLocalInput(period.clock_out_at);

  async function submit() {
    setPending(true);
    setState({ status: "idle" });
    const result = await amendDutyAction(
      period.id,
      // Only send what actually changed, so an untouched field is not
      // rewritten with the same value and logged as an amendment.
      clockIn !== originalIn ? toIso(clockIn) : null,
      clockOut !== originalOut ? toIso(clockOut) : null,
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
          onClick={() => setOpen(true)}
          className="text-[0.65rem] font-semibold text-status-blue hover:underline"
        >
          Correct
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
      className="mt-2 space-y-2 rounded-md border border-border bg-background p-3"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          Duty in
          <input
            type="datetime-local"
            value={clockIn}
            onChange={(e) => setClockIn(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-foreground"
          />
        </label>
        <label className="block text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          Duty out
          <input
            type="datetime-local"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-foreground"
          />
        </label>
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
          className="rounded-md bg-status-blue px-3 py-1.5 text-[0.65rem] font-semibold text-white hover:brightness-110 disabled:opacity-40"
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
