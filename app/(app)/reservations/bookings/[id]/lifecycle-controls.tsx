"use client";

import { useActionState, useState } from "react";

import type { BookingStatus } from "@/lib/api/reservations";

import {
  cancelAction,
  completeAction,
  confirmAction,
  type LifecycleState,
  quoteAction,
} from "./actions";

const _initial: LifecycleState = { status: "idle" };

/**
 * Booking lifecycle controls. Each transition has its own form + server
 * action so the audit trail (quoted_at / confirmed_by / cancelled_reason)
 * is always stamped by exactly the endpoint that owns it.
 *
 * We render only the transitions that are actually allowed from the
 * current status. Matches the backend's `_ALLOWED` map exactly — if the
 * backend map widens, widen this one to match.
 */

const ALLOWED: Record<BookingStatus, Array<"quote" | "confirm" | "complete" | "cancel">> = {
  requested: ["quote", "confirm", "cancel"],
  quoted: ["confirm", "cancel"],
  confirmed: ["complete", "cancel"],
  completed: [],
  cancelled: [],
};

export function LifecycleControls({
  bookingId,
  currentStatus,
  currentQuoteCents,
}: {
  bookingId: string;
  currentStatus: BookingStatus;
  currentQuoteCents: number | null;
}) {
  const actions = ALLOWED[currentStatus];
  if (actions.length === 0) return null;

  return (
    <section className="space-y-4">
      {actions.includes("quote") ? (
        <QuoteForm
          bookingId={bookingId}
          defaultDollars={
            currentQuoteCents !== null
              ? (currentQuoteCents / 100).toFixed(2)
              : ""
          }
        />
      ) : null}
      {actions.includes("confirm") ? (
        <ConfirmForm bookingId={bookingId} />
      ) : null}
      {actions.includes("complete") ? (
        <CompleteForm bookingId={bookingId} />
      ) : null}
      {actions.includes("cancel") ? (
        <CancelForm bookingId={bookingId} />
      ) : null}
    </section>
  );
}

function QuoteForm({
  bookingId,
  defaultDollars,
}: {
  bookingId: string;
  defaultDollars: string;
}) {
  const [state, formAction, pending] = useActionState(quoteAction, _initial);
  return (
    <ActionCard title="Quote">
      {state.status === "error" && state.message ? (
        <ErrorBanner message={state.message} />
      ) : null}
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="booking_id" value={bookingId} />
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Quote (USD)
          </span>
          <input
            name="quoted_total_dollars"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={defaultDollars}
            className="ff-inline"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Send Quote"}
        </button>
      </form>
      <FormStyles />
    </ActionCard>
  );
}

function ConfirmForm({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(
    confirmAction,
    _initial,
  );
  return (
    <ActionCard title="Confirm booking">
      {state.status === "error" && state.message ? (
        <ErrorBanner message={state.message} />
      ) : null}
      <form action={formAction} className="flex items-end justify-end">
        <input type="hidden" name="booking_id" value={bookingId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-status-green bg-status-green/15 px-3 py-2 text-xs font-semibold text-status-green hover:bg-status-green/20 disabled:opacity-60"
        >
          {pending ? "Confirming…" : "Confirm"}
        </button>
      </form>
    </ActionCard>
  );
}

function CompleteForm({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(
    completeAction,
    _initial,
  );
  return (
    <ActionCard title="Mark completed">
      {state.status === "error" && state.message ? (
        <ErrorBanner message={state.message} />
      ) : null}
      <form action={formAction} className="flex items-end justify-end">
        <input type="hidden" name="booking_id" value={bookingId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground/80 hover:bg-muted/40 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Mark Completed"}
        </button>
      </form>
    </ActionCard>
  );
}

function CancelForm({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(cancelAction, _initial);
  const [reason, setReason] = useState("");
  return (
    <ActionCard title="Cancel booking" tone="danger">
      {state.status === "error" && state.message ? (
        <ErrorBanner message={state.message} />
      ) : null}
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="booking_id" value={bookingId} />
        <label className="block">
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Reason (required)
          </span>
          <textarea
            name="reason"
            rows={2}
            required
            maxLength={4000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="ff-inline"
            placeholder="Customer weather no-go, aircraft unavailable, etc."
          />
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending || reason.trim() === ""}
            className="rounded-md border border-status-red/60 bg-status-red/15 px-3 py-2 text-xs font-semibold text-status-red hover:bg-status-red/20 disabled:opacity-60"
          >
            {pending ? "Cancelling…" : "Cancel Booking"}
          </button>
        </div>
      </form>
      <FormStyles />
    </ActionCard>
  );
}

function ActionCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        "rounded-lg border bg-card p-4 " +
        (tone === "danger" ? "border-status-red/30" : "border-border")
      }
    >
      <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-3 rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
    >
      {message}
    </div>
  );
}

function FormStyles() {
  return (
    <style>{`
      .ff-inline {
        width: 100%;
        background: hsl(var(--background));
        color: hsl(var(--foreground));
        border: 1px solid hsl(var(--border));
        border-radius: 8px;
        padding: 0.5rem 0.75rem;
        font-size: 0.8125rem;
        outline: none;
      }
      .ff-inline:focus:not(:disabled) {
        border-color: hsl(var(--primary));
        box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
      }
      textarea.ff-inline { resize: vertical; font-family: inherit; }
    `}</style>
  );
}
