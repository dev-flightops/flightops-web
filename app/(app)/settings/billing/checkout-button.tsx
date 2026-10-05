"use client";

import { useActionState } from "react";

import {
  startCheckoutAction,
  type BillingActionState,
} from "./actions";

const _initial: BillingActionState = { status: "idle" };

/**
 * Choose Plan button. Renders only on plans where the backend
 * flagged `checkout_available=true`, and only while the company has no
 * live subscription. Wraps a form so the seat-count input can go along;
 * the server action redirects to Stripe on success or returns a mapped
 * error message on failure. Where Stripe returns the browser to is
 * decided by the backend, not by this page.
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

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="plan_code" value={planCode} />
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
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
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
