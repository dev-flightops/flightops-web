"use server";

import { revalidatePath } from "next/cache";

import { ApiError, SessionExpiredError } from "@/lib/api/client";
import {
  getCustomerInvoicePdfBase64,
  markCustomerInvoicePaid,
  recordCustomerInvoicePayment,
  sendCustomerInvoice,
  voidCustomerInvoice,
  voidCustomerInvoicePayment,
} from "@/lib/api/customer-invoices";

import { money } from "./money";
import { isFormMethod, METHOD_LABELS, parseAmount } from "./payments";

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
};

function explain(err: unknown, fallback: string): string {
  if (err instanceof SessionExpiredError) {
    return "Your session has expired. Sign in again.";
  }
  if (err instanceof ApiError) {
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
