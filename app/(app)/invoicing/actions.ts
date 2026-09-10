"use server";

import { revalidatePath } from "next/cache";

import { ApiError, SessionExpiredError } from "@/lib/api/client";
import {
  getCustomerInvoicePdfBase64,
  markCustomerInvoicePaid,
  sendCustomerInvoice,
  voidCustomerInvoice,
} from "@/lib/api/customer-invoices";

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
    "This invoice has a line with no price yet. Set a cargo rate in " +
    "company settings, regenerate, and try again.",
  paid_on_in_the_future: "A payment cannot be dated in the future.",
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
    return { status: "ok", message: "Sent." };
  } catch (err) {
    return { status: "error", message: explain(err, "Could not send it") };
  }
}

export async function markPaidAction(
  invoiceId: string,
  paidOn: string,
): Promise<InvoiceActionState> {
  try {
    await markCustomerInvoicePaid(invoiceId, paidOn || undefined);
    revalidatePath("/invoicing");
    revalidatePath(`/invoicing/${invoiceId}`);
    return { status: "ok", message: "Marked paid." };
  } catch (err) {
    return { status: "error", message: explain(err, "Could not record it") };
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
