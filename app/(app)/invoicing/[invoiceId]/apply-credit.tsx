"use client";

import { useEffect, useRef, useState } from "react";

import type { CreditNote } from "@/lib/api/customer-invoices";

import { applyCreditAction, type InvoiceActionState } from "../actions";
import { money } from "../money";
import { centsToInput, parseAmount, todayLocalIsoDate } from "../payments";

/**
 * Pay an invoice from the customer's credit notes (#127): money they
 * were given back as credit on an earlier invoice. It settles the
 * invoice like a payment, and is not money collected.
 *
 * Offered while the invoice is sent and owes something, and the
 * customer has credit left. Mounted whenever payments show, so its
 * confirmation outlives the page refresh that turns it off.
 */
export function ApplyCredit({
  invoiceId,
  creditNotes,
  outstandingCents,
  canApply,
}: {
  invoiceId: string;
  creditNotes: CreditNote[];
  outstandingCents: number;
  canApply: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [noteId, setNoteId] = useState("");
  const [amount, setAmount] = useState("");
  const [appliedOn, setAppliedOn] = useState("");
  const [today, setToday] = useState("");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<InvoiceActionState>({ status: "idle" });
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status === "ok") statusRef.current?.focus();
  }, [state]);

  const offered = canApply && creditNotes.length > 0;
  const credit = creditNotes.reduce((sum, n) => sum + n.remaining_cents, 0);

  function choose(id: string) {
    setNoteId(id);
    const note = creditNotes.find((n) => n.id === id);
    if (note) setAmount(centsToInput(Math.min(note.remaining_cents, outstandingCents)));
  }

  function start() {
    const now = todayLocalIsoDate();
    setAppliedOn(now);
    setToday(now);
    setState({ status: "idle" });
    choose(creditNotes[0]?.id ?? "");
    setOpen(true);
  }

  function problem(): string | null {
    const note = creditNotes.find((n) => n.id === noteId);
    if (!note) return "Choose the credit note to pay with.";
    const cents = parseAmount(amount);
    if (cents === null || cents <= 0) return "Enter the amount of credit to use, like 50.00.";
    if (cents > note.remaining_cents) {
      return `That is more than the ${money(note.remaining_cents)} left on the credit note.`;
    }
    if (cents > outstandingCents) {
      return `That is more than the ${money(outstandingCents)} outstanding.`;
    }
    if (!appliedOn) return "Enter the date.";
    if (appliedOn > today) return "Credit cannot be applied with a date in the future.";
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
    const result = await applyCreditAction(invoiceId, noteId, amount, appliedOn);
    setPending(false);
    setState(result);
    if (result.status === "ok") setOpen(false);
  }

  return (
    <div className="mt-2 space-y-2">
      {offered && !open && (
        <p className="text-sm text-foreground">
          {`The customer has ${money(credit)} of credit. `}
          <button
            type="button"
            onClick={start}
            className="btn-caps ml-1 rounded-md border border-border px-3 py-1.5 text-[0.72rem] text-foreground hover:border-foreground"
          >
            Pay with credit
          </button>
        </p>
      )}

      {offered && open && (
        <form
          onSubmit={(e) => void submit(e)}
          aria-label="Pay with credit"
          className="rounded-md border border-border bg-background p-3"
          noValidate
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block min-w-0">
              <span className="field-label">Credit note</span>
              <select value={noteId} onChange={(e) => choose(e.target.value)} className="ff-input">
                {creditNotes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {`${n.credit_number} · ${money(n.remaining_cents)} left (from ${n.invoice_number})`}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="field-label">Amount</span>
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
              <span className="field-label">Date</span>
              <input
                type="date"
                value={appliedOn}
                max={today}
                onChange={(e) => setAppliedOn(e.target.value)}
                className="ff-input"
              />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="btn-caps rounded-md bg-primary px-3 py-1.5 text-[0.72rem] text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {pending ? "Applying…" : "Apply credit"}
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
        <p role="alert" className="notice notice-red">
          {state.message}
        </p>
      )}
      {state.status === "ok" && (
        <p ref={statusRef} role="status" tabIndex={-1} className="text-xs text-status-green">
          {state.message}
        </p>
      )}
    </div>
  );
}
