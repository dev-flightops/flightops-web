"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonOutline } from "@/components/ff/controls";

import {
  approvePayEventAction,
  approvePendingPayEventsAction,
  generatePayEventsAction,
  type PayEventActionState,
} from "./actions";

/**
 * Per-row Approve / Reject buttons for pending pay events. Wraps
 * the server action in `useTransition` so the row disables cleanly
 * while the request is in flight.
 */
export function ApproveRejectButtons({ eventId }: { eventId: string }) {
  const [pending, start] = useTransition();

  function submit(action: "approve" | "reject") {
    start(async () => {
      await approvePayEventAction(eventId, action);
    });
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => submit("approve")}
        className="text-xs font-semibold text-status-green hover:underline disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => submit("reject")}
        className="text-xs font-semibold text-status-red hover:underline disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}

/**
 * Which dates the list shows, and the two things done to a whole range: flights
 * and shifts make their own events, so a period is too many rows to work one by
 * one. The events come from what happened, so Bring up to date is safe to press
 * again; what it can't know is whether the hours are right, which is why Approve
 * all leaves anything flagged for a look.
 */
export function PayEventRange({
  status,
  start: initialStart,
  end: initialEnd,
}: {
  status: string;
  start: string;
  end: string;
}) {
  const router = useRouter();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [pending, begin] = useTransition();
  const [outcome, setOutcome] = useState<PayEventActionState | null>(null);
  const noRange = !start || !end;

  function run(work: () => Promise<PayEventActionState>) {
    setOutcome(null);
    begin(async () => {
      const result = await work();
      setOutcome(result);
      if (result.status === "ok") router.refresh();
    });
  }

  function approveAll() {
    if (!window.confirm(`Approve every pending event from ${start} to ${end}? Anything flagged for a look stays pending.`)) return;
    run(() => approvePendingPayEventsAction(start, end));
  }

  return (
    <form method="get" action="/payroll" aria-label="Pay event dates" className="mb-4 flex flex-wrap items-end gap-2">
      {status ? <input type="hidden" name="status" value={status} /> : null}
      <label className="w-40">
        <span className="field-label">From</span>
        <input type="date" name="start" value={start} onChange={(e) => setStart(e.target.value)} className="ff-input px-2 py-1.5 text-sm" />
      </label>
      <label className="w-40">
        <span className="field-label">To</span>
        <input type="date" name="end" value={end} onChange={(e) => setEnd(e.target.value)} className="ff-input px-2 py-1.5 text-sm" />
      </label>
      <button type="submit" className={`${buttonOutline} h-[34px] px-3`}>
        Show
      </button>
      <button
        type="button"
        disabled={pending || noRange}
        onClick={() => run(() => generatePayEventsAction(start, end))}
        title={noRange ? "Choose the dates first" : undefined}
        className={`${buttonOutline} h-[34px] px-3 disabled:opacity-50`}
      >
        Bring up to date
      </button>
      <button
        type="button"
        disabled={pending || noRange}
        onClick={approveAll}
        title={noRange ? "Choose the dates first" : undefined}
        className={`${buttonOutline} h-[34px] px-3 disabled:opacity-50`}
      >
        Approve all pending
      </button>
      {outcome?.message ? (
        <p
          role={outcome.status === "error" ? "alert" : "status"}
          className={`w-full text-xs ${outcome.status === "error" ? "text-status-red" : "font-semibold text-status-green"}`}
        >
          {outcome.message}
        </p>
      ) : null}
    </form>
  );
}
