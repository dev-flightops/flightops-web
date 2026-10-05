"use client";

import { useActionState } from "react";

import {
  openPortalAction,
  type BillingActionState,
} from "./actions";

const _initial: BillingActionState = { status: "idle" };

/**
 * Manage billing — the Stripe Customer Portal entry point, where the
 * company changes plan or seats, updates the card, pays what's due or
 * cancels. Rendered only while the subscription is live (the parent
 * decides). The server action redirects to the portal URL on success;
 * a mapped error message shows on failure.
 */
export function ManagePaymentButton() {
  const [state, formAction, pending] = useActionState(
    openPortalAction,
    _initial,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-accent disabled:opacity-60"
      >
        {pending ? "Redirecting…" : "Manage billing →"}
      </button>
      {state.status === "error" && state.message && (
        <p role="alert" className="w-full text-[0.65rem] text-status-red">
          {state.message}
        </p>
      )}
    </form>
  );
}
