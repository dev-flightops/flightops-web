"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import type { CustomerPayment } from "@/lib/api/customer-invoices";

import { voidPaymentAction, type InvoiceActionState } from "../actions";
import { money } from "../money";
import { METHOD_LABELS } from "../payments";

/**
 * The payments on an invoice, oldest first by the date the money
 * arrived, and the way to void one entered in error.
 *
 * Legacy voided a booking's payment with a confirm
 * (templates/manifest/flight_reservations.html:160); this one also asks
 * why, because a payment voided with no reason is the one an auditor
 * asks about. A voided payment stays in the list, struck through, with
 * the reason under it: it no longer counts as paid, and the history
 * still shows what was entered.
 *
 * At 390px the table has to keep its Amount column in view: the date
 * and the amount do not wrap, a long unbroken reference (an ACH trace,
 * a wire IMAD) breaks anywhere, and each row's Void sits under its
 * amount rather than in a column of its own.
 */
export function PaymentHistory({
  invoiceId,
  invoiceNumber,
  payments,
}: {
  invoiceId: string;
  invoiceNumber: string;
  payments: CustomerPayment[];
}) {
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<InvoiceActionState>({ status: "idle" });
  const statusRef = useRef<HTMLParagraphElement>(null);

  // The confirm that held focus closes on success; the confirmation
  // takes it, so it is read out rather than lost.
  useEffect(() => {
    if (state.status === "ok") statusRef.current?.focus();
  }, [state]);

  const target =
    payments.find((p) => p.id === voidingId && p.voided_at === null) ?? null;

  function start(paymentId: string) {
    setVoidingId(paymentId);
    setReason("");
    setState({ status: "idle" });
  }

  function cancel() {
    setVoidingId(null);
    setReason("");
    setState({ status: "idle" });
  }

  async function confirm(payment: CustomerPayment) {
    setPending(true);
    setState({ status: "idle" });
    const result = await voidPaymentAction(invoiceId, payment.id, reason);
    setPending(false);
    setState(result);
    if (result.status === "ok") {
      setVoidingId(null);
      setReason("");
    }
  }

  return (
    <div className="mb-3 space-y-2">
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Payments on invoice {invoiceNumber}
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <th scope="col" className="py-2 pr-4">Received</th>
                <th scope="col" className="py-2 pr-4">Method</th>
                <th scope="col" className="py-2 pr-4">Reference</th>
                <th scope="col" className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const voided = p.voided_at !== null;
                const label = `${money(p.amount_cents)} (${METHOD_LABELS[p.method] ?? p.method})`;
                return (
                  <Fragment key={p.id}>
                    <tr
                      className={
                        voided ? "" : "border-b border-border last:border-0"
                      }
                    >
                      <td className="whitespace-nowrap py-2 pr-4 tabular-nums text-foreground">
                        {p.received_on}
                      </td>
                      <td className="py-2 pr-4 text-foreground">
                        {METHOD_LABELS[p.method] ?? p.method}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground [overflow-wrap:anywhere]">
                        {p.reference ?? "—"}
                      </td>
                      <td className="whitespace-nowrap py-2 text-right tabular-nums">
                        {voided ? (
                          <s className="text-muted-foreground">
                            {money(p.amount_cents)}
                          </s>
                        ) : (
                          <span className="text-foreground">
                            {money(p.amount_cents)}
                          </span>
                        )}
                        {!voided && (
                          // Under the amount, not beside it: the cell
                          // stays as narrow as the amount at 390px.
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => start(p.id)}
                              disabled={pending}
                              aria-label={`Void payment of ${label}`}
                              className="rounded border border-status-red/40 px-1.5 py-0.5 text-[0.65rem] font-semibold text-status-red hover:bg-status-red/10 disabled:opacity-50"
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
                          <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase text-muted-foreground">
                            Voided
                          </span>
                          {p.voided_at?.slice(0, 10)}: {p.void_reason}
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

      {target && (
        <div
          role="group"
          aria-label="Void a payment"
          className="rounded-md border border-border bg-background p-3"
        >
          <p className="text-xs text-foreground">
            Void the{" "}
            <span className="font-semibold tabular-nums">
              {money(target.amount_cents)}{" "}
              {METHOD_LABELS[target.method] ?? target.method}
            </span>{" "}
            payment received {target.received_on}? It stays in the history,
            marked voided, and stops counting as paid.
          </p>
          <label className="mt-2 block text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Why is it being voided?
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="e.g. check returned unpaid"
              autoComplete="off"
              className="ff-input mt-1 font-normal normal-case tracking-normal"
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void confirm(target)}
              disabled={pending || reason.trim().length < 3}
              className="rounded-md bg-status-red px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-40"
            >
              {pending ? "Voiding…" : "Confirm void"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
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
        <p
          ref={statusRef}
          role="status"
          tabIndex={-1}
          className="text-xs text-status-green"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
