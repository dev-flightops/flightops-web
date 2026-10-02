"use client";

import { useState } from "react";

import { recordPaymentAction, type InvoiceActionState } from "../actions";
import { money } from "../money";
import {
  centsToInput,
  FORM_METHODS,
  parseAmount,
  todayLocalIsoDate,
} from "../payments";

/**
 * Record money received against a sent invoice: part of what is owed,
 * or all of it. The amount starts at the outstanding balance, so the
 * common case (the customer paid the invoice) is a method and a click.
 *
 * Checked here before the round trip: an amount that is not an amount,
 * more than is outstanding, no method, a date after today. The service
 * checks the balance again under a lock, which is what stops two people
 * recording the same cheque at once.
 */
export function RecordPayment({
  invoiceId,
  outstandingCents,
}: {
  invoiceId: string;
  outstandingCents: number;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [receivedOn, setReceivedOn] = useState("");
  const [reference, setReference] = useState("");
  const [today, setToday] = useState("");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<InvoiceActionState>({ status: "idle" });

  function start() {
    // Defaults are read when the form opens, not at render: the
    // balance may have changed since, and the date is the browser's,
    // which is the day the person means.
    const now = todayLocalIsoDate();
    setAmount(centsToInput(outstandingCents));
    setMethod("");
    setReceivedOn(now);
    setReference("");
    setToday(now);
    setState({ status: "idle" });
    setOpen(true);
  }

  function problem(): string | null {
    const cents = parseAmount(amount);
    if (cents === null || cents <= 0) {
      return "Enter the amount received, like 250.00.";
    }
    if (cents > outstandingCents) {
      return `That is more than the ${money(outstandingCents)} outstanding.`;
    }
    if (!method) return "Choose how the money arrived.";
    if (!receivedOn) return "Enter the date the money arrived.";
    if (receivedOn > today) return "A payment cannot be dated in the future.";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const why = problem();
    if (why) {
      setState({ status: "error", message: why });
      return;
    }
    setPending(true);
    setState({ status: "idle" });
    const result = await recordPaymentAction(invoiceId, {
      amount,
      method,
      receivedOn,
      reference,
    });
    setPending(false);
    setState(result);
    if (result.status === "ok") setOpen(false);
  }

  const labelClass =
    "mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground";

  return (
    <div className="space-y-2">
      {!open && (
        <button
          type="button"
          onClick={start}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
        >
          Record payment
        </button>
      )}

      {open && (
        <form
          onSubmit={(e) => void submit(e)}
          aria-label="Record payment"
          className="rounded-md border border-border bg-background p-3"
          noValidate
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className={labelClass}>Amount</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="ff-input tabular-nums"
                autoComplete="off"
              />
            </label>
            <label className="block min-w-0">
              <span className={labelClass}>Method</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="ff-input"
              >
                <option value="">Choose…</option>
                {FORM_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0">
              <span className={labelClass}>Received</span>
              <input
                type="date"
                value={receivedOn}
                max={today}
                onChange={(e) => setReceivedOn(e.target.value)}
                className="ff-input"
              />
            </label>
            <label className="block min-w-0">
              <span className={labelClass}>Reference</span>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={120}
                placeholder="Check number, card or bank reference"
                className="ff-input"
                autoComplete="off"
              />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {pending ? "Recording…" : "Record payment"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setState({ status: "idle" });
              }}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </p>
      )}
      {state.status === "ok" && (
        <p role="status" className="text-xs text-status-green">
          {state.message}
        </p>
      )}
    </div>
  );
}
