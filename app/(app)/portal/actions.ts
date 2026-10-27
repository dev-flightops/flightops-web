"use server";

import { ApiError, SessionExpiredError } from "@/lib/api/client";
import { getPortalInvoicePdfBase64 } from "@/lib/api/portal";

export type PortalPdfResult =
  | { status: "ok"; base64: string; filename: string }
  | { status: "error"; message: string };

/**
 * One of the customer's invoices as its PDF (#129), fetched server-side
 * and handed back as base64, as staff invoicing does: the document sits
 * behind a bearer token the browser doesn't hold.
 *
 * A server action posts to its host page, /portal, which a customer's
 * login may open (lib/external-access.ts), so no route outside the
 * portal is needed.
 */
export async function portalInvoicePdfAction(
  invoiceId: string,
  invoiceNumber: string,
): Promise<PortalPdfResult> {
  try {
    const base64 = await getPortalInvoicePdfBase64(invoiceId);
    return { status: "ok", base64, filename: `${invoiceNumber}.pdf` };
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return { status: "error", message: "Your session has expired. Sign in again." };
    }
    if (err instanceof ApiError && err.status === 404) {
      return { status: "error", message: "This invoice is no longer available. Refresh the page." };
    }
    return { status: "error", message: "The PDF couldn't be made just now. Try again in a moment." };
  }
}
