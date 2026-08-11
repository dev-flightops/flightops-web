/**
 * Typed wrapper for the billing-service endpoints on the ops gateway.
 * Router is mounted at /billing (see infra/nginx/dev.conf) — the
 * billing router uses no internal prefix so gateway paths map 1:1
 * to service paths (unlike the academy router).
 *
 * Every endpoint is gated on `Role.EXEC_ADMIN` on the backend;
 * expect a 403 for pilots / chief pilots hitting these paths.
 */

import { apiFetch } from "./client";

export type PlanCode = "starter" | "growth" | "scale";

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthly_price_cents: number;
  currency: string;
  seat_limit: number | null;
  /** True when Stripe is fully wired for this plan (price id
   *  present). Frontend hides Choose Plan when false. Slice 1
   *  (this PR) doesn't ship checkout — the field is included so
   *  Slice 2 can consume it without another wrapper. */
  checkout_available: boolean;
}

export interface PlanListResponse {
  items: Plan[];
}

export interface Subscription {
  id: string;
  plan_code: string;
  plan_name: string;
  /** Free-form: Stripe adds statuses over time (paused, etc.).
   *  Known values: trialing | active | past_due | canceled |
   *  incomplete | incomplete_expired | unpaid | paused. */
  status: string;
  seat_count: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
}

export interface Invoice {
  id: string;
  number: string | null;
  /** draft | open | paid | uncollectible | void — mirrored from Stripe. */
  status: string;
  amount_due_cents: number;
  amount_paid_cents: number;
  amount_remaining_cents: number;
  /** Precomputed display total (dollars/whatever major unit) — safer
   *  than re-doing the /100 math on the frontend for currencies
   *  without minor units. */
  amount_paid_major: string;
  currency: string;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  created_at: string;
}

export interface InvoiceListResponse {
  items: Invoice[];
  total: number;
}

export interface BillingOverviewResponse {
  subscription: Subscription | null;
  invoices: Invoice[];
  plans: Plan[];
}

/** One-shot payload for /settings/billing — subscription + last 12
 *  invoices + plan catalog in a single round trip. Use this on
 *  page load; individual endpoints below are for refreshes. */
export async function getBillingOverview(): Promise<BillingOverviewResponse> {
  return apiFetch<BillingOverviewResponse>("/billing/overview");
}

/** Current subscription (or `null` when the tenant has no live one). */
export async function getSubscription(): Promise<Subscription | null> {
  return apiFetch<Subscription | null>("/billing/subscription");
}

export async function listInvoices(
  limit = 25,
): Promise<InvoiceListResponse> {
  const qs = limit === 25 ? "" : `?limit=${limit}`;
  return apiFetch<InvoiceListResponse>(`/billing/invoices${qs}`);
}

export async function listPlans(): Promise<PlanListResponse> {
  return apiFetch<PlanListResponse>("/billing/plans");
}
