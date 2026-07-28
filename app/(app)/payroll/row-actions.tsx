"use client";

import { useTransition } from "react";

import { approvePayEventAction } from "./actions";

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
        className="text-xs font-semibold text-status-green hover:text-status-green/80 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => submit("reject")}
        className="text-xs font-semibold text-status-red hover:text-status-red/80 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
