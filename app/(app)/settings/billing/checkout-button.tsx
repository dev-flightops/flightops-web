"use client";

import { useActionState, useEffect, useState } from "react";

import {
  startCheckoutAction,
  type BillingActionState,
} from "./actions";

const _initial: BillingActionState = { status: "idle" };

/**
 * Choose Plan button. Renders only on plans where the backend
 * flagged `checkout_available=true` (Stripe price id present).
 * Wraps a form so the seat-count input can go along; server
 * action redirects to Stripe on success or returns a mapped
 * error message on failure. `window.location.origin` is passed
 * so the success/cancel URLs come back to this deployment.
 */
export function ChooseCheckoutButton({
  planCode,
  defaultSeatCount = 1,
  seatLimit,
}: {
  planCode: "starter" | "growth" | "scale";
  defaultSeatCount?: number;
  /** Cap the seat-count input. null = unlimited (Scale). */
  seatLimit: number | null;
}) {
  const [state, formAction, pending] = useActionState(
    startCheckoutAction,
    _initial,
  );
  // window.location.origin isn't available at SSR time, so we
  // snapshot it after mount and thread it into the form as a
  // hidden input. Any user action fires only after mount so the
  // value is always populated when the action runs.
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="plan_code" value={planCode} />
      <input type="hidden" name="origin" value={origin} />
      <label className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
        Seats
        <input
          type="number"
          name="seat_count"
          min={1}
          max={seatLimit ?? undefined}
          defaultValue={defaultSeatCount}
          className="w-16 rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
        />
      </label>
      <button
        type="submit"
        disabled={pending || origin === ""}
        className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Redirecting…" : "Choose plan →"}
      </button>
      {state.status === "error" && state.message && (
        <p
          role="alert"
          className="w-full text-[0.65rem] text-status-red"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
