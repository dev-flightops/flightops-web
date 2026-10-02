/**
 * Typed wrapper for the billing-service endpoints on the ops gateway.
 * Router is mounted at /billing (see infra/nginx/dev.conf) — the
 * billing router uses no internal prefix so gateway paths map 1:1
 * to service paths (unlike the academy router).
 *
 * Every endpoint admits an Executive Admin and a Director of
 * Operations; expect a 403 for every other role.
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
  /** True when this plan can be bought here: Stripe has a key, the
   *  plan has a Stripe price, and the backend knows where to send the
   *  browser back to. The page offers Choose plan only when true. */
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
  /** Running count of invoice.payment_failed events since the last
   *  successful charge. 0 on a healthy subscription; non-zero drives
   *  the dunning banner on /settings/billing. */
  dunning_attempts: number;
  /** Stripe's next retry timestamp when a charge failed. Null on a
   *  healthy subscription. */
  next_payment_attempt_at: string | null;
  /** What the company still owes on its open invoices, in cents. 0
   *  when nothing is due. */
  amount_due_cents: number;
  /** Currency of `amount_due_cents`; null when nothing is due. */
  amount_due_currency: string | null;
}

/** Statuses after which Stripe can never bill the subscription again.
 *  Any other status (past due and unpaid included) is a subscription
 *  that can still charge, so the page offers Manage billing, not a
 *  second checkout. Mirrors ENDED_SUBSCRIPTION_STATUSES in the billing
 *  service. */
const ENDED_STATUSES: ReadonlySet<string> = new Set([
  "canceled",
  "incomplete_expired",
]);

export function subscriptionHasEnded(subscription: Pick<Subscription, "status">): boolean {
  return ENDED_STATUSES.has(subscription.status);
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
  /** Checkout and the Customer portal can run on this deployment:
   *  Stripe has a key and the backend knows where to send the browser
   *  back to. False without Stripe, whatever subscription is shown. */
  billing_ready: boolean;
}

/** One-shot payload for /settings/billing — subscription + last 12
 *  invoices + plan catalog in a single round trip. Use this on
 *  page load; individual endpoints below are for refreshes. The
 *  subscription is the latest whatever its status (a live one first),
 *  so past due, unpaid and cancelled all arrive here. */
export async function getBillingOverview(): Promise<BillingOverviewResponse> {
  return apiFetch<BillingOverviewResponse>("/billing/overview");
}

/** The live subscription (or `null` when none can still bill). */
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

// ---- Stripe write path (Slice 2) --------------------------------------------

export type PlanChoiceCode = "starter" | "growth" | "scale";

/** Where Stripe sends the browser afterwards is decided by the backend
 *  from its configured web origin, so the request carries no URLs. */
export interface CheckoutSessionRequest {
  plan_code: PlanChoiceCode;
  seat_count: number;
}

export interface CheckoutSessionResponse {
  session_id: string;
  url: string;
}

export interface PortalSessionResponse {
  url: string;
}

/** Create a Stripe Checkout Session and return the hosted URL. The
 *  frontend redirects the browser to that URL; Stripe handles the
 *  card entry + subscription lifecycle and the webhook (Slice 3)
 *  writes the TenantSubscription row on completion. */
export async function createCheckoutSession(
  body: CheckoutSessionRequest,
): Promise<CheckoutSessionResponse> {
  return apiFetch<CheckoutSessionResponse>("/billing/checkout-session", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Create a Stripe Customer Portal Session for the tenant's existing
 *  subscription. Stripe returns the browser to the billing page; the
 *  backend builds that URL. */
export async function createPortalSession(): Promise<PortalSessionResponse> {
  return apiFetch<PortalSessionResponse>("/billing/portal-session", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
