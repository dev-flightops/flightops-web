"use server";

import { revalidatePath } from "next/cache";

import { ApiError, SessionExpiredError } from "@/lib/api/client";
import {
  applyCustomerCredit,
  getCustomerInvoicePdfBase64,
  markCustomerInvoicePaid,
  recordCustomerInvoicePayment,
  refundCustomerInvoice,
  sendCustomerInvoice,
  voidCustomerInvoice,
  voidCustomerInvoicePayment,
  voidCustomerInvoiceRefund,
  type RefundKind,
} from "@/lib/api/customer-invoices";

import { money } from "./money";
import {
  isFormMethod,
  METHOD_LABELS,
  parseAmount,
  REFUND_APPROVAL_OVER_CENTS,
} from "./payments";

/**
 * Invoice lifecycle actions, from the server.
 *
 * The buttons are client components and these functions go through
 * `apiFetch`, which begins with `await auth()` — server only.
 * `lib/api/client-boundary.test.ts` fails the build for importing them
 * across that line.
 *
 * Failures come back as values so a refusal can be explained on the
 * page. The service's refusals are the interesting half here: an
 * invoice with an unpriced line cannot be sent, and the transitions
 * are a graph rather than a free-for-all.
 */
export type InvoiceActionState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/** Service slugs to sentences. "cannot_go_from_paid_to_void" is not
 *  something to put in front of somebody chasing a payment. */
const REFUSALS: Record<string, string> = {
  invoice_has_unpriced_lines:
    "This invoice has a line with no price yet. Set the cargo rate in " +
    "Settings → Company, then void this draft and raise the flight's " +
    "invoices again.",
  paid_on_in_the_future: "A payment cannot be dated in the future.",
  received_on_in_the_future: "A payment cannot be dated in the future.",
  invoice_has_payments:
    "This invoice has payments recorded against it, so it cannot be voided.",
  invoice_not_sent_yet: "Send the invoice before recording a payment on it.",
  invoice_is_void: "This invoice is void and cannot take a payment.",
  payment_already_voided: "That payment has already been voided.",
  payment_not_found: "That payment is not on this invoice.",
  invoice_not_found: "That invoice no longer exists.",
  // Refunds and credit notes (#127).
  invoice_has_nothing_to_refund:
    "Nothing has been received on this invoice, so there is nothing to give back.",
  refunded_on_in_the_future: "A refund cannot be dated in the future.",
  applied_on_in_the_future: "Credit cannot be applied with a date in the future.",
  refund_needs_an_approver:
    "A refund over $500 needs an approver. Choose who approved it.",
  approver_is_yourself: "Someone else has to approve a refund over $500.",
  approver_cannot_approve_refunds:
    "That person can't approve refunds. An Exec Admin or the Director of Operations can.",
  payment_id_required: "Choose the payment the money goes back to.",
  payment_is_voided: "That payment was voided, so nothing can go back to it.",
  credit_goes_back_as_credit:
    "A credit note paid that, so it goes back as a credit note, not to a payment.",
  credit_note_needs_a_customer:
    "A walk-in can't hold a credit note. Give the money back to the payment instead.",
  refund_already_voided: "That refund has already been voided.",
  refund_not_found: "That refund is not on this invoice.",
  credit_note_in_use:
    "That credit note has paid an invoice. Void that payment first.",
  credit_note_not_found: "That credit note no longer exists or was voided.",
  credit_note_is_another_customers: "That credit note belongs to another customer.",
  payment_has_refunds:
    "Money has gone back to this payment. Void that refund first.",
  payment_covers_a_refund:
    "Money has been given back from what this payment brought in. Void that refund or credit note first.",
};

function explain(err: unknown, fallback: string): string {
  if (err instanceof SessionExpiredError) {
    return "Your session has expired. Sign in again.";
  }
  if (err instanceof ApiError) {
    // The company is read-only until its subscription is paid (#127):
    // apiFetch's ReadOnlyError carries the sentence to show.
    if (err.status === 402) return err.message;
    // The body is the service's detail slug. Match a known one, and
    // otherwise say what happened without pasting raw JSON at the user.
    for (const [slug, sentence] of Object.entries(REFUSALS)) {
      if (String(err.message).includes(slug)) return sentence;
    }
    // Usually somebody else's payment landed first, so say what is
    // left rather than only that it was refused.
    const over = String(err.message).match(
      /payment_exceeds_outstanding_of_(-?\d+)/,
    );
    if (over) {
      return `That is more than the ${money(Math.max(0, Number(over[1])))} still outstanding.`;
    }
    const back = String(err.message).match(
      /refund_exceeds_(received|payment)_of_(-?\d+)/,
    );
    if (back) {
      const left = money(Math.max(0, Number(back[2])));
      return back[1] === "payment"
        ? `That is more than the ${left} that can still go back to that payment.`
        : `That is more than the ${left} received and not yet given back.`;
    }
    const credit = String(err.message).match(/credit_exceeds_remaining_of_(-?\d+)/);
    if (credit) {
      return `That is more than the ${money(Math.max(0, Number(credit[1])))} left on the credit note.`;
    }
    const transition = String(err.message).match(
      /cannot_go_from_(\w+?)_to_(\w+)/,
    );
    if (transition) {
      return `An invoice that is ${transition[1]} cannot be marked ${transition[2]}.`;
    }
    return `${fallback} (HTTP ${err.status}).`;
  }
  return "Could not reach billing-service.";
}

export async function sendInvoiceAction(
  invoiceId: string,
): Promise<InvoiceActionState> {
  try {
    await sendCustomerInvoice(invoiceId);
    revalidatePath("/invoicing");
    revalidatePath(`/invoicing/${invoiceId}`);
    // Recorded as sent, not emailed: nothing is emailed yet (#25, item
    // 8), so the message must not say it went anywhere.
    return { status: "ok", message: "Marked as sent." };
  } catch (err) {
    return {
      status: "error",
      message: explain(err, "Could not mark it as sent"),
    };
  }
}

/** Paid in full: the service records the outstanding balance as one
 *  payment by `method`, dated `paidOn`, with the reference when one is
 *  given, and closes the invoice. */
export async function markPaidAction(
  invoiceId: string,
  method: string,
  paidOn: string,
  reference: string,
): Promise<InvoiceActionState> {
  if (!isFormMethod(method)) {
    return { status: "error", message: "Choose how the money arrived." };
  }
  try {
    await markCustomerInvoicePaid(
      invoiceId,
      method,
      paidOn || undefined,
      reference.trim() || null,
    );
    revalidatePath("/invoicing");
    revalidatePath(`/invoicing/${invoiceId}`);
    return { status: "ok", message: "Marked paid." };
  } catch (err) {
    return { status: "error", message: explain(err, "Could not record it") };
  }
}

export interface RecordPaymentForm {
  /** As typed: "250", "250.00", "1,250.00". */
  amount: string;
  method: string;
  /** YYYY-MM-DD, the day the money arrived. */
  receivedOn: string;
  reference: string;
}

/** Money received against a sent invoice. The form checks the same
 *  things first; these checks are for whatever reaches the action
 *  without it, and the service has the last word on the balance. */
export async function recordPaymentAction(
  invoiceId: string,
  form: RecordPaymentForm,
): Promise<InvoiceActionState> {
  const cents = parseAmount(form.amount);
  if (cents === null || cents <= 0) {
    return {
      status: "error",
      message: "Enter the amount received, like 250.00.",
    };
  }
  if (!isFormMethod(form.method)) {
    return { status: "error", message: "Choose how the money arrived." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.receivedOn)) {
    return { status: "error", message: "Enter the date the money arrived." };
  }
  try {
    const result = await recordCustomerInvoicePayment(invoiceId, {
      amount_cents: cents,
      method: form.method,
      received_on: form.receivedOn,
      reference: form.reference.trim() || null,
    });
    revalidatePath("/invoicing");
    revalidatePath(`/invoicing/${invoiceId}`);
    const recorded = `Recorded ${money(cents)} (${METHOD_LABELS[form.method]}).`;
    return {
      status: "ok",
      message: result.settled
        ? `${recorded} The invoice is paid.`
        : `${recorded} ${money(result.outstanding_cents)} still outstanding.`,
    };
  } catch (err) {
    return {
      status: "error",
      message: explain(err, "Could not record the payment"),
    };
  }
}

export async function voidInvoiceAction(
  invoiceId: string,
  reason: string,
): Promise<InvoiceActionState> {
  if (reason.trim().length < 3) {
    // Asked here as well as on the server so the round trip is not
    // wasted. Voiding is a financial correction and one with no stated
    // reason is the one an auditor asks about.
    return { status: "error", message: "Say why it is being voided." };
  }
  try {
    await voidCustomerInvoice(invoiceId, reason.trim());
    revalidatePath("/invoicing");
    revalidatePath(`/invoicing/${invoiceId}`);
    return { status: "ok", message: "Voided." };
  } catch (err) {
    return { status: "error", message: explain(err, "Could not void it") };
  }
}

/** Void a payment entered in error. It stays in the history, marked,
 *  and stops counting as paid; the invoice follows the money that is
 *  left. The reason is asked for here too, so a blank one costs no
 *  round trip. */
export async function voidPaymentAction(
  invoiceId: string,
  paymentId: string,
  reason: string,
): Promise<InvoiceActionState> {
  if (reason.trim().length < 3) {
    return {
      status: "error",
      message: "Say why the payment is being voided.",
    };
  }
  try {
    const result = await voidCustomerInvoicePayment(
      invoiceId,
      paymentId,
      reason.trim(),
    );
    revalidatePath("/invoicing");
    revalidatePath(`/invoicing/${invoiceId}`);
    const { amount_cents, method } = result.payment;
    return {
      status: "ok",
      message: `Voided the ${money(amount_cents)} (${METHOD_LABELS[method] ?? method}) payment. ${money(result.outstanding_cents)} outstanding.`,
    };
  } catch (err) {
    return {
      status: "error",
      message: explain(err, "Could not void the payment"),
    };
  }
}

export interface RefundForm {
  /** As typed: "50", "50.00". */
  amount: string;
  kind: RefundKind;
  /** The payment the money goes back to, for `original_payment`. */
  paymentId: string;
  /** YYYY-MM-DD. */
  refundedOn: string;
  reason: string;
  reference: string;
  /** Needed over $500: who approved it. */
  approverId: string;
}

/** Give money back on an invoice (#127): to the payment it came from,
 *  or as a credit note for a later invoice of the customer's. */
export async function refundAction(
  invoiceId: string,
  form: RefundForm,
): Promise<InvoiceActionState> {
  const cents = parseAmount(form.amount);
  if (cents === null || cents <= 0) {
    return { status: "error", message: "Enter the amount to give back, like 50.00." };
  }
  if (form.kind === "original_payment" && !form.paymentId) {
    return { status: "error", message: "Choose the payment the money goes back to." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.refundedOn)) {
    return { status: "error", message: "Enter the date of the refund." };
  }
  if (form.reason.trim().length < 3) {
    return { status: "error", message: "Say why the money is going back." };
  }
  if (cents > REFUND_APPROVAL_OVER_CENTS && !form.approverId) {
    return { status: "error", message: "A refund over $500 needs an approver. Choose who approved it." };
  }
  try {
    const { refund } = await refundCustomerInvoice(invoiceId, {
      kind: form.kind,
      amount_cents: cents,
      payment_id: form.kind === "original_payment" ? form.paymentId : null,
      refunded_on: form.refundedOn,
      reason: form.reason.trim(),
      reference: form.reference.trim() || null,
      approved_by_user_id: form.approverId || null,
    });
    revalidatePath("/invoicing");
    revalidatePath(`/invoicing/${invoiceId}`);
    return {
      status: "ok",
      message:
        refund.kind === "credit_note"
          ? `Issued credit note ${refund.credit_number} for ${money(cents)}. It can pay a later invoice of the customer's.`
          : `Recorded ${money(cents)} going back to the payment.`,
    };
  } catch (err) {
    return { status: "error", message: explain(err, "Could not record the refund") };
  }
}

/** Void a refund entered in error (#127); the money counts as received
 *  again. */
export async function voidRefundAction(
  invoiceId: string,
  refundId: string,
  reason: string,
): Promise<InvoiceActionState> {
  if (reason.trim().length < 3) {
    return { status: "error", message: "Say why the refund is being voided." };
  }
  try {
    const { refund } = await voidCustomerInvoiceRefund(invoiceId, refundId, reason.trim());
    revalidatePath("/invoicing");
    revalidatePath(`/invoicing/${invoiceId}`);
    return {
      status: "ok",
      message:
        refund.kind === "credit_note"
          ? `Voided credit note ${refund.credit_number}.`
          : `Voided the ${money(refund.amount_cents)} refund.`,
    };
  } catch (err) {
    return { status: "error", message: explain(err, "Could not void the refund") };
  }
}

/** Pay an invoice from one of its customer's credit notes (#127). */
export async function applyCreditAction(
  invoiceId: string,
  creditNoteId: string,
  amount: string,
  appliedOn: string,
): Promise<InvoiceActionState> {
  const cents = parseAmount(amount);
  if (cents === null || cents <= 0) {
    return { status: "error", message: "Enter the amount of credit to use, like 50.00." };
  }
  if (!creditNoteId) {
    return { status: "error", message: "Choose the credit note to pay with." };
  }
  try {
    const result = await applyCustomerCredit(invoiceId, creditNoteId, cents, appliedOn || null);
    revalidatePath("/invoicing");
    revalidatePath(`/invoicing/${invoiceId}`);
    const used = `Paid ${money(cents)} from credit note ${result.payment.reference}.`;
    return {
      status: "ok",
      message: result.settled
        ? `${used} The invoice is paid.`
        : `${used} ${money(result.outstanding_cents)} still outstanding.`,
    };
  } catch (err) {
    return { status: "error", message: explain(err, "Could not apply the credit") };
  }
}

export type PdfResult =
  | { status: "ok"; base64: string; filename: string }
  | { status: "error"; message: string };

/**
 * The PDF, fetched server-side and handed back as base64.
 *
 * The document lives behind a bearer token the browser does not have,
 * so linking the gateway URL directly would 404 — the same boundary
 * that left the New Booking search broken for weeks.
 */
export async function invoicePdfAction(
  invoiceId: string,
  invoiceNumber: string,
): Promise<PdfResult> {
  try {
    const base64 = await getCustomerInvoicePdfBase64(invoiceId);
    return { status: "ok", base64, filename: `${invoiceNumber}.pdf` };
  } catch (err) {
    return {
      status: "error",
      message: explain(err, "Could not build the PDF"),
    };
  }
}
