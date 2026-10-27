"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import type {
  CustomerPayment,
  CustomerRefund,
  RefundKind,
} from "@/lib/api/customer-invoices";

import {
  refundAction,
  voidRefundAction,
  type InvoiceActionState,
} from "../actions";
import { money } from "../money";
import {
  centsToInput,
  METHOD_LABELS,
  parseAmount,
  REFUND_APPROVAL_OVER_CENTS,
  todayLocalIsoDate,
} from "../payments";

export interface Approver {
  id: string;
  name: string;
}

/**
 * Money given back on an invoice (#127), and the way to give some.
 *
 * The client's decision: back to the original payment, or as a credit
 * note for a later invoice, and over $500 an approver, as in the old
 * system. Legacy took a typed name for the approver; here it is chosen
 * from the people who may approve one (an Exec Admin or the Director of
 * Operations), never the person entering it.
 *
 * A refund doesn't move the balance: it takes back what was charged and
 * what was received alike. What it changes is where the money is: back
 * with the customer's card or check, or on a credit note that pays a
 * later invoice of theirs.
 */
export function Refunds({
  invoiceId,
  invoiceNumber,
  refunds,
  payments,
  refundableCents,
  hasCustomer,
  canRefund,
  approvers,
}: {
  invoiceId: string;
  invoiceNumber: string;
  refunds: CustomerRefund[];
  payments: CustomerPayment[];
  /** Received and not yet given back. */
  refundableCents: number;
  /** A walk-in can't hold a credit note. */
  hasCustomer: boolean;
  canRefund: boolean;
  approvers: Approver[];
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<RefundKind>("original_payment");
  const [paymentId, setPaymentId] = useState("");
  const [refundedOn, setRefundedOn] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [approverId, setApproverId] = useState("");
  const [today, setToday] = useState("");
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<InvoiceActionState>({ status: "idle" });
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status === "ok") statusRef.current?.focus();
  }, [state]);

  // What can still go back to each payment: the payment less the
  // refunds that went back to it. A payment by credit goes back as
  // credit, so it isn't offered.
  const backTo = new Map<string, number>();
  for (const r of refunds) {
    if (r.voided_at === null && r.payment_id) {
      backTo.set(r.payment_id, (backTo.get(r.payment_id) ?? 0) + r.amount_cents);
    }
  }
  const returnable = payments
    .filter((p) => p.voided_at === null && p.method !== "credit")
    .map((p) => ({ payment: p, left: p.amount_cents - (backTo.get(p.id) ?? 0) }))
    .filter((x) => x.left > 0);

  const cents = parseAmount(amount);
  const needsApprover = cents !== null && cents > REFUND_APPROVAL_OVER_CENTS;

  function start() {
    const now = todayLocalIsoDate();
    setAmount(centsToInput(refundableCents));
    setKind(returnable.length > 0 || !hasCustomer ? "original_payment" : "credit_note");
    setPaymentId(returnable.length === 1 ? returnable[0].payment.id : "");
    setRefundedOn(now);
    setToday(now);
    setReason("");
    setReference("");
    setApproverId("");
    setState({ status: "idle" });
    setOpen(true);
  }

  function problem(): string | null {
    if (cents === null || cents <= 0) return "Enter the amount to give back, like 50.00.";
    if (cents > refundableCents) {
      return `That is more than the ${money(refundableCents)} received and not yet given back.`;
    }
    if (kind === "original_payment") {
      const chosen = returnable.find((x) => x.payment.id === paymentId);
      if (!chosen) return "Choose the payment the money goes back to.";
      if (cents > chosen.left) {
        return `That is more than the ${money(chosen.left)} that can still go back to that payment.`;
      }
    }
    if (!refundedOn) return "Enter the date of the refund.";
    if (refundedOn > today) return "A refund cannot be dated in the future.";
    if (reason.trim().length < 3) return "Say why the money is going back.";
    if (needsApprover && !approverId) {
      return "A refund over $500 needs an approver. Choose who approved it.";
    }
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
    const result = await refundAction(invoiceId, {
      amount,
      kind,
      paymentId,
      refundedOn,
      reason,
      reference,
      approverId: needsApprover ? approverId : "",
    });
    setPending(false);
    setState(result);
    if (result.status === "ok") setOpen(false);
  }

  async function confirmVoid(refund: CustomerRefund) {
    setPending(true);
    setState({ status: "idle" });
    const result = await voidRefundAction(invoiceId, refund.id, voidReason);
    setPending(false);
    setState(result);
    if (result.status === "ok") {
      setVoidingId(null);
      setVoidReason("");
    }
  }

  const voiding = refunds.find((r) => r.id === voidingId && r.voided_at === null) ?? null;
  const paymentById = new Map(payments.map((p) => [p.id, p]));

  function where(r: CustomerRefund): string {
    if (r.kind === "credit_note") {
      const left = r.credit_remaining_cents ?? 0;
      return r.voided_at
        ? `Credit note ${r.credit_number}`
        : `Credit note ${r.credit_number} · ${left > 0 ? `${money(left)} left` : "used"}`;
    }
    const p = r.payment_id ? paymentById.get(r.payment_id) : undefined;
    return p
      ? `To the ${METHOD_LABELS[p.method] ?? p.method} payment of ${p.received_on}`
      : "To the original payment";
  }

  if (refunds.length === 0 && !canRefund && state.status === "idle") return null;

  return (
    <section
      aria-labelledby="refunds-heading"
      className="mt-4 rounded-lg border border-border bg-card p-5"
    >
      <h2 id="refunds-heading" className="eyebrow mb-3">
        Refunds
      </h2>

      {refunds.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">Nothing given back.</p>
      ) : (
        <div className="mb-3 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Refunds on invoice {invoiceNumber}</caption>
            <thead>
              <tr className="ff-thead">
                <th scope="col" className="py-2 pr-4">Date</th>
                <th scope="col" className="py-2 pr-4">Given back</th>
                <th scope="col" className="py-2 pr-4">Why</th>
                <th scope="col" className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((r) => {
                const voided = r.voided_at !== null;
                return (
                  <Fragment key={r.id}>
                    <tr className={voided ? "" : "border-b border-border last:border-0"}>
                      <td className="whitespace-nowrap py-2 pr-4 tabular-nums text-foreground">
                        {r.refunded_on}
                      </td>
                      <td className="py-2 pr-4 text-foreground">
                        {where(r)}
                        {r.reference ? (
                          <div className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                            {r.reference}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground [overflow-wrap:anywhere]">
                        {r.reason}
                        {r.approved_by_name ? (
                          <div className="text-xs">Approved by {r.approved_by_name}</div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap py-2 text-right tabular-nums">
                        {voided ? (
                          <s className="text-muted-foreground">{money(r.amount_cents)}</s>
                        ) : (
                          <span className="text-foreground">{money(r.amount_cents)}</span>
                        )}
                        {!voided && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setVoidingId(r.id);
                                setVoidReason("");
                                setState({ status: "idle" });
                              }}
                              disabled={pending}
                              aria-label={`Void refund of ${money(r.amount_cents)}`}
                              className="btn-caps rounded-sm border border-status-red/60 px-1.5 py-0.5 text-[0.62rem] text-status-red hover:border-status-red disabled:opacity-50"
                            >
                              Void
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {voided && (
                      <tr className="border-b border-border last:border-0">
                        <td
                          colSpan={4}
                          className="pb-2 text-xs text-muted-foreground [overflow-wrap:anywhere]"
                        >
                          <span className="eyebrow mr-1.5">Voided</span>
                          {r.voided_at?.slice(0, 10)}: {r.void_reason}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {voiding && (
        <div
          role="group"
          aria-label="Void a refund"
          className="mb-3 rounded-md border border-border bg-background p-3"
        >
          <p className="text-xs text-foreground">
            {`Void the ${money(voiding.amount_cents)} refund of ${voiding.refunded_on}? It stays in the history, marked voided, and the money counts as received again.`}
          </p>
          <label className="field-label mb-0 mt-2">
            Why is it being voided?
            <input
              type="text"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              maxLength={500}
              autoComplete="off"
              className="ff-input mt-1 font-normal normal-case tracking-normal"
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void confirmVoid(voiding)}
              disabled={pending || voidReason.trim().length < 3}
              className="btn-caps rounded-md bg-status-red-fill px-3 py-1.5 text-[0.72rem] text-white hover:brightness-95 disabled:opacity-40"
            >
              {pending ? "Voiding…" : "Confirm void"}
            </button>
            <button
              type="button"
              onClick={() => setVoidingId(null)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {canRefund && !open && (
        <button
          type="button"
          onClick={start}
          className="btn-caps rounded-md border border-border px-3 py-1.5 text-[0.72rem] text-foreground hover:border-foreground"
        >
          Refund
        </button>
      )}

      {canRefund && open && (
        <form
          onSubmit={(e) => void submit(e)}
          aria-label="Refund"
          className="rounded-md border border-border bg-background p-3"
          noValidate
        >
          <fieldset className="mb-3">
            <legend className="field-label">Give it back</legend>
            <div className="flex flex-col gap-1.5 text-sm text-foreground sm:flex-row sm:gap-5">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="refund-kind"
                  checked={kind === "original_payment"}
                  onChange={() => setKind("original_payment")}
                  disabled={returnable.length === 0}
                />
                To the payment it came from
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="refund-kind"
                  checked={kind === "credit_note"}
                  onChange={() => setKind("credit_note")}
                  disabled={!hasCustomer}
                />
                As a credit note for a later invoice
              </label>
            </div>
            {!hasCustomer && (
              <p className="mt-1 text-xs text-muted-foreground">
                A walk-in can&apos;t hold a credit note.
              </p>
            )}
          </fieldset>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            {kind === "original_payment" ? (
              <label className="block min-w-0">
                <span className="field-label">Payment</span>
                <select
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  className="ff-input"
                >
                  <option value="">Choose…</option>
                  {returnable.map(({ payment, left }) => (
                    <option key={payment.id} value={payment.id}>
                      {`${payment.received_on} · ${METHOD_LABELS[payment.method] ?? payment.method} · ${money(payment.amount_cents)}${left < payment.amount_cents ? ` (${money(left)} left)` : ""}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div />
            )}
            <label className="block min-w-0">
              <span className="field-label">Date</span>
              <input
                type="date"
                value={refundedOn}
                max={today}
                onChange={(e) => setRefundedOn(e.target.value)}
                className="ff-input"
              />
            </label>
            {kind === "original_payment" ? (
              <label className="block min-w-0">
                <span className="field-label">Reference</span>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={120}
                  placeholder="Card refund or check number"
                  className="ff-input"
                  autoComplete="off"
                />
              </label>
            ) : (
              <div />
            )}
            <label className="block min-w-0 sm:col-span-2">
              <span className="field-label">Why</span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder="e.g. flight cancelled"
                className="ff-input"
                autoComplete="off"
              />
            </label>
            {needsApprover && (
              <div className="min-w-0 sm:col-span-2">
                <label className="block">
                  <span className="field-label">Approved by</span>
                  <select
                    value={approverId}
                    onChange={(e) => setApproverId(e.target.value)}
                    aria-describedby="refund-approver-help"
                    className="ff-input"
                  >
                    <option value="">Choose…</option>
                    {approvers.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p id="refund-approver-help" className="mt-1 text-xs text-muted-foreground">
                  Over $500 needs another person who may approve refunds: an
                  Exec Admin or the Director of Operations.
                </p>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="btn-caps rounded-md bg-primary px-3 py-1.5 text-[0.72rem] text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {pending ? "Recording…" : kind === "credit_note" ? "Issue credit note" : "Record refund"}
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
        <p role="alert" className="notice notice-red mt-2">
          {state.message}
        </p>
      )}
      {state.status === "ok" && (
        <p
          ref={statusRef}
          role="status"
          tabIndex={-1}
          className="mt-2 text-xs text-status-green"
        >
          {state.message}
        </p>
      )}
    </section>
  );
}
