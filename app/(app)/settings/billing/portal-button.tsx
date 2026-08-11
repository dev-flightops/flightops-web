"use client";

import { useActionState, useEffect, useState } from "react";

import {
  openPortalAction,
  type BillingActionState,
} from "./actions";

const _initial: BillingActionState = { status: "idle" };

/**
 * Manage payment / cancel — Stripe Customer Portal entry point.
 * Only renders when the tenant already has an active subscription
 * (parent card gates on subscription != null). Server action
 * redirects to the portal URL on success; the parent form + a
 * mapped error message handle failure.
 */
export function ManagePaymentButton() {
  const [state, formAction, pending] = useActionState(
    openPortalAction,
    _initial,
  );
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="origin" value={origin} />
      <button
        type="submit"
        disabled={pending || origin === ""}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/10 disabled:opacity-60"
      >
        {pending ? "Redirecting…" : "Manage payment →"}
      </button>
      {state.status === "error" && state.message && (
        <p role="alert" className="w-full text-[0.65rem] text-status-red">
          {state.message}
        </p>
      )}
    </form>
  );
}
