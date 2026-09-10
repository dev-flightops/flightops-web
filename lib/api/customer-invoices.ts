/**
 * Customer invoices — what we bill a charter customer for a flight.
 *
 * Deliberately a separate module from `lib/api/billing.ts`, which
 * already exports `listInvoices` for Stripe's subscription invoices on
 * the operator's own account with us. Money in versus money out. The
 * backend splits the tables for the same reason (`customer_invoices`
 * versus `tenant_invoices`), and two similarly-named client functions
 * in one file is how the wrong one gets imported.
 */

import { apiFetch } from "./client";

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export type InvoiceLineKind =
  | "passenger"
  | "baggage"
  | "cargo"
  | "mail"
  | "adjustment";

export interface InvoiceLine {
  id: string;
  description: string;
  kind: InvoiceLineKind;
  /** Thousandths on the wire, so the client is not handed a float to
   *  round differently from the server. */
  quantity_milli: number;
  unit_price_cents: number;
  amount_cents: number;
  /** The line exists but has no price — cargo carried with no
   *  configured rate. Rendered, so a draft is never sent with a hole
   *  in it. */
  unpriced: boolean;
  sort_order: number;
}

export interface InvoiceCustomerRef {
  id: string;
  full_name: string;
}

export interface CustomerInvoice {
  id: string;
  invoice_number: string;
  /** Null for a walk-in, or when the customer record was deleted —
   *  the FK is SET NULL so removing a customer cannot remove the money
   *  they owed. */
  customer: InvoiceCustomerRef | null;
  flight_id: string | null;
  flight_number: string | null;
  /** The tail as it was when billed — a snapshot, not a join. */
  aircraft_tail: string | null;
  flight_date: string | null;
  origin_icao: string | null;
  destination_icao: string | null;
  invoice_date: string;
  due_date: string | null;
  subtotal_cents: number;
  tax_rate: string | null;
  tax_cents: number;
  total_cents: number;
  status: InvoiceStatus;
  sent_at: string | null;
  paid_on: string | null;
  has_unpriced_lines: boolean;
}

export interface CustomerInvoiceDetail extends CustomerInvoice {
  lines: InvoiceLine[];
  void_reason: string | null;
  notes: string | null;
}

export interface CustomerInvoiceList {
  items: CustomerInvoice[];
  total: number;
  /** Everything not paid and not void, across the tenant rather than
   *  the page — a header total that changes when you paginate is worse
   *  than none. */
  outstanding_cents: number;
}

export async function listCustomerInvoices(params: {
  status?: InvoiceStatus;
  limit?: number;
  offset?: number;
} = {}): Promise<CustomerInvoiceList> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.limit !== undefined) q.set("limit", String(params.limit));
  if (params.offset !== undefined) q.set("offset", String(params.offset));
  const qs = q.toString();
  return apiFetch<CustomerInvoiceList>(
    `/billing/customer-invoices${qs ? `?${qs}` : ""}`,
    { cache: "no-store" },
  );
}

export async function getCustomerInvoice(
  invoiceId: string,
): Promise<CustomerInvoiceDetail> {
  return apiFetch<CustomerInvoiceDetail>(
    `/billing/customer-invoices/${invoiceId}`,
    { cache: "no-store" },
  );
}

export async function sendCustomerInvoice(
  invoiceId: string,
): Promise<CustomerInvoice> {
  return apiFetch<CustomerInvoice>(
    `/billing/customer-invoices/${invoiceId}/send`,
    { method: "POST" },
  );
}

export async function markCustomerInvoicePaid(
  invoiceId: string,
  paidOn?: string,
): Promise<CustomerInvoice> {
  return apiFetch<CustomerInvoice>(
    `/billing/customer-invoices/${invoiceId}/paid`,
    { method: "POST", body: JSON.stringify({ paid_on: paidOn ?? null }) },
  );
}

export async function voidCustomerInvoice(
  invoiceId: string,
  reason: string,
): Promise<CustomerInvoice> {
  return apiFetch<CustomerInvoice>(
    `/billing/customer-invoices/${invoiceId}/void`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

/**
 * Raise drafts for a flown flight. Returns the invoices created and,
 * separately, the bookings that did not make it onto one — "where is
 * this passenger" is the first question anyone asks.
 */
export interface GenerateResult {
  invoices: CustomerInvoice[];
  skipped: Array<{ booking_id: string; reason: string }>;
}

export async function generateCustomerInvoices(
  flightId: string,
): Promise<GenerateResult> {
  return apiFetch<GenerateResult>(
    `/billing/customer-invoices/generate?flight_id=${flightId}`,
    { method: "POST" },
  );
}

/**
 * The invoice as a PDF, base64-encoded.
 *
 * Through `apiFetch` like everything else rather than a hand-rolled
 * fetch: it already attaches the session's bearer token and maps a 401
 * to SessionExpiredError, and re-implementing that here would be a
 * second copy of the auth path to keep in step.
 *
 * Base64 because the bytes have to cross a server-action boundary to
 * reach the browser, and a Buffer does not survive that.
 */
export async function getCustomerInvoicePdfBase64(
  invoiceId: string,
): Promise<string> {
  return apiFetch<string>(
    `/billing/customer-invoices/${invoiceId}/pdf`,
    { parseAs: "base64", cache: "no-store" },
  );
}
