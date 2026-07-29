"use client";

import { useTransition } from "react";

import {
  CHARTER_LEGAL_NEXT,
  CHARTER_STATUS_LABELS,
  type CharterStatus,
} from "@/lib/api/charter";

import { transitionCharterAction } from "./actions";

/**
 * Per-row status transition buttons. Backend enforces the state
 * machine; the client mirrors the legal set so the buttons render
 * only where a transition would succeed. `cancelled` renders as a
 * red "Cancel" for visual separation from forward-only actions.
 */
export function TransitionButtons({
  charterId,
  currentStatus,
}: {
  charterId: string;
  currentStatus: CharterStatus;
}) {
  const [pending, start] = useTransition();
  const next = CHARTER_LEGAL_NEXT[currentStatus];
  if (next.length === 0) return null;

  function submit(to: CharterStatus) {
    if (to === "cancelled") {
      if (
        !confirm(
          "Cancel this charter request? This can't be reversed from the pipeline view.",
        )
      ) {
        return;
      }
    }
    start(async () => {
      await transitionCharterAction(charterId, to);
    });
  }

  return (
    <div className="flex justify-end gap-2">
      {next
        .filter((s) => s !== "cancelled")
        .map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => submit(s)}
            className="text-xs font-semibold text-status-blue hover:text-status-blue/80 disabled:opacity-50"
          >
            → {CHARTER_STATUS_LABELS[s]}
          </button>
        ))}
      {next.includes("cancelled") && (
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("cancelled")}
          className="text-xs font-semibold text-status-red hover:text-status-red/80 disabled:opacity-50"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
