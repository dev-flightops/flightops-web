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
  /** The unit price to four decimals, as a decimal string ("0.4750").
   *  A cargo rate per lb has four, which `unit_price_cents` rounds to
   *  48; the amount is computed from this one, so it is the one shown. */
  unit_price: string;
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

/** What the money arrived as: cash, check, card, transfer ("ACH or
 *  wire") or other. `credit` is a credit note paying the invoice (#127):
 *  it settles it like money, but no money arrived; its reference is the
 *  note's number. `account` and `comp` are only ever history: the client
 *  decided (#127) that a charge on account stays owed until it is paid
 *  and a comp seat is charged nothing, so neither is money received. */
export type PaymentMethod =
  | "cash"
  | "card"
  | "check"
  | "transfer"
  | "account"
  | "comp"
  | "other"
  | "credit";

export interface CustomerPayment {
  id: string;
  amount_cents: number;
  method: PaymentMethod;
  /** When the money arrived, not when it was recorded. */
  received_on: string;
  reference: string | null;
  notes: string | null;
  /** Set when the payment was voided as entered in error: it stays in
   *  the history and no longer counts as paid. `voided_by` is the user
   *  who voided it. */
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
}

export interface CustomerInvoiceDetail extends CustomerInvoice {
  lines: InvoiceLine[];
  void_reason: string | null;
  notes: string | null;
  /** Sum of the `payments` that are not voided. */
  paid_cents: number;
  /** The total less payments, never below zero; zero for a void
   *  invoice. */
  outstanding_cents: number;
  /** Oldest first, by the date the money arrived. */
  payments: CustomerPayment[];
  /** Money given back on this invoice (#127), oldest first, voided ones
   *  marked. A refund doesn't move the balance. */
  refunds: CustomerRefund[];
  /** The refunds that still count. */
  refunded_cents: number;
  /** The customer's credit notes with credit left: what can pay this
   *  invoice. Empty for a walk-in. */
  credit_notes: CreditNote[];
}

/** Back to the payment the money came from, or a credit note for a
 *  later invoice (#127). */
export type RefundKind = "original_payment" | "credit_note";

export interface CustomerRefund {
  id: string;
  kind: RefundKind;
  amount_cents: number;
  refunded_on: string;
  reason: string;
  reference: string | null;
  /** `original_payment`: the payment it went back to. */
  payment_id: string | null;
  /** `credit_note`: its number and what it still has to pay with. */
  credit_number: string | null;
  credit_remaining_cents: number | null;
  /** Who approved it, when over $500. */
  approved_by_name: string | null;
  voided_at: string | null;
  void_reason: string | null;
}

export interface CreditNote {
  id: string;
  credit_number: string;
  /** The invoice the money was first received on. */
  invoice_number: string;
  refunded_on: string;
  remaining_cents: number;
}

export interface CustomerInvoiceList {
  items: CustomerInvoice[];
  total: number;
  /** Sent invoices' totals less the payments against them, across the
   *  tenant rather than the page — a header total that changes when you
   *  paginate is worse than none. Drafts are not counted: nobody has
   *  been asked for them yet. The same rule as AR aging. */
  outstanding_cents: number;
}

export async function listCustomerInvoices(params: {
  status?: InvoiceStatus;
  /** One customer's invoices; `outstanding_cents` is then their balance. */
  customer_id?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<CustomerInvoiceList> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.customer_id) q.set("customer_id", params.customer_id);
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

/** Close a sent invoice as paid in full. The service records whatever
 *  is still outstanding as one payment, by `method`, dated `paidOn`
 *  (today when omitted), with `reference` (a check number, say) when
 *  given, before it closes the invoice. */
export async function markCustomerInvoicePaid(
  invoiceId: string,
  method: PaymentMethod,
  paidOn?: string,
  reference?: string | null,
): Promise<CustomerInvoice> {
  return apiFetch<CustomerInvoice>(
    `/billing/customer-invoices/${invoiceId}/paid`,
    {
      method: "POST",
      body: JSON.stringify({
        method,
        paid_on: paidOn ?? null,
        reference: reference ?? null,
      }),
    },
  );
}

export interface RecordPaymentInput {
  amount_cents: number;
  method: PaymentMethod;
  received_on: string;
  reference: string | null;
}

export interface RecordPaymentResult {
  payment: CustomerPayment;
  /** The invoice after the payment. */
  invoice: CustomerInvoice;
  paid_cents: number;
  outstanding_cents: number;
  /** True when this payment closed the invoice. */
  settled: boolean;
}

export interface PaymentVoidResult {
  /** The payment, now voided. */
  payment: CustomerPayment;
  /** The invoice after the void: back to sent when what still counts
   *  no longer covers it. */
  invoice: CustomerInvoice;
  paid_cents: number;
  outstanding_cents: number;
}

/** Void a payment entered in error. It stays on the invoice, marked,
 *  and stops counting as paid. The reason is required. */
export async function voidCustomerInvoicePayment(
  invoiceId: string,
  paymentId: string,
  reason: string,
): Promise<PaymentVoidResult> {
  return apiFetch<PaymentVoidResult>(
    `/billing/customer-invoices/${invoiceId}/payments/${paymentId}/void`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

/** Money received against a sent invoice, part or all of what is
 *  outstanding. The service refuses more than the outstanding balance,
 *  a date in the future, and drafts and voids. */
export interface RefundInput {
  kind: RefundKind;
  amount_cents: number;
  payment_id?: string | null;
  refunded_on?: string | null;
  reason: string;
  reference?: string | null;
  /** Required over $500: another person who may approve refunds. */
  approved_by_user_id?: string | null;
}

export interface RefundResult {
  refund: CustomerRefund;
  invoice: CustomerInvoice;
  paid_cents: number;
  refunded_cents: number;
}

/** Give money back on an invoice (#127). */
export async function refundCustomerInvoice(
  invoiceId: string,
  input: RefundInput,
): Promise<RefundResult> {
  return apiFetch<RefundResult>(`/billing/customer-invoices/${invoiceId}/refunds`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Void a refund entered in error (#127). */
export async function voidCustomerInvoiceRefund(
  invoiceId: string,
  refundId: string,
  reason: string,
): Promise<RefundResult> {
  return apiFetch<RefundResult>(
    `/billing/customer-invoices/${invoiceId}/refunds/${refundId}/void`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

/** Pay an invoice from one of its customer's credit notes (#127). */
export async function applyCustomerCredit(
  invoiceId: string,
  creditNoteId: string,
  amountCents: number,
  appliedOn?: string | null,
): Promise<RecordPaymentResult> {
  return apiFetch<RecordPaymentResult>(`/billing/customer-invoices/${invoiceId}/credit`, {
    method: "POST",
    body: JSON.stringify({
      credit_note_id: creditNoteId,
      amount_cents: amountCents,
      applied_on: appliedOn ?? null,
    }),
  });
}

export async function recordCustomerInvoicePayment(
  invoiceId: string,
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  return apiFetch<RecordPaymentResult>(
    `/billing/customer-invoices/${invoiceId}/payments`,
    { method: "POST", body: JSON.stringify(input) },
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
 *
 * 409 `invoice_generation_in_progress` when another raise for the same
 * flight is running; 409 `flight_has_not_flown`; 404 `flight_not_found`.
 */
export interface SkippedBooking {
  booking_id: string;
  /** "cancelled", "no quote on the booking", "quoted at zero",
   *  "already invoiced on INV-000123". */
  reason: string;
  /** Who the booking is for; null only if the customer record is gone. */
  customer: InvoiceCustomerRef | null;
}

export interface GenerateResult {
  invoices: CustomerInvoice[];
  skipped: SkippedBooking[];
  /** What became of the flight's cargo and USPS mail, in sentences:
   *  which invoice carries the cargo, or why none does. */
  notes: string[];
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

// ── AR aging ─────────────────────────────────────────────────────────

export interface AgingBucket {
  key: string;
  label: string;
  outstanding_cents: number;
}

export interface AgedInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string | null;
  invoice_date: string;
  due_date: string;
  total_cents: number;
  paid_cents: number;
  outstanding_cents: number;
  days_past_due: number;
  bucket: string;
}

export interface AgingReport {
  as_of: string;
  /** Every bucket present even at zero, so a client rendering columns
   *  cannot silently omit one. */
  buckets: AgingBucket[];
  invoices: AgedInvoice[];
  total_outstanding_cents: number;
  /** Sent invoices with no due date. They cannot be aged, so they are
   *  reported separately rather than dropped or called current. */
  undated_count: number;
  undated_cents: number;
  note: string;
}

export async function getAgingReport(asOf?: string): Promise<AgingReport> {
  const qs = asOf ? `?as_of=${asOf}` : "";
  return apiFetch<AgingReport>(
    `/billing/customer-invoices/reports/aging${qs}`,
    { cache: "no-store" },
  );
}
