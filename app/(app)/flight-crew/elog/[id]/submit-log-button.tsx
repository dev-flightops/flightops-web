"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

import {
  submitFlightLogAction,
  type SubmitFlightLogState,
} from "../actions";

/**
 * Sticky page-header Submit Log button. Lives in the header rather
 * than buried on Tab 1 so the pilot can submit from any active tab —
 * a small deviation from legacy log_page.html, but a deliberate one
 * (legacy required scrolling back to Tab 1 to submit).
 *
 * On success we refresh the route so the server re-fetches the log
 * and the header swaps draft → SUBMITTED. apiFetch is server-only
 * which is why the click goes through `submitFlightLogAction` rather
 * than calling `submitFlightLog` directly.
 */
export function SubmitLogButton({ logId }: { logId: string }) {
  const [state, action, pending] = useActionState<
    SubmitFlightLogState,
    FormData
  >(submitFlightLogAction, { status: "idle" });
  const router = useRouter();
  const [refreshPending, startRefresh] = useTransition();

  useEffect(() => {
    if (state.status === "submitted") {
      // The server already wrote the status; refresh re-renders the
      // page with the new shape (button gone, badge green).
      startRefresh(() => router.refresh());
    }
  }, [state.status, router]);

  return (
    <form action={action}>
      <input type="hidden" name="log_id" value={logId} />
      <button
        type="submit"
        disabled={pending || refreshPending || state.status === "submitted"}
        className="inline-flex items-center gap-1.5 rounded-md bg-status-green px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
      >
        {(pending || refreshPending) && <Spinner size="xs" />}
        Submit Log
      </button>
      {state.status === "error" && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {state.message}
        </p>
      )}
    </form>
  );
}
