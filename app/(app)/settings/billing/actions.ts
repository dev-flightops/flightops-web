"use server";

import { redirect } from "next/navigation";

import {
  createCheckoutSession,
  createPortalSession,
  type PlanChoiceCode,
} from "@/lib/api/billing";
import { ApiError } from "@/lib/api/client";

export interface BillingActionState {
  status: "idle" | "error";
  message?: string;
}

/**
 * Kick off a Stripe Checkout Session for the picked plan + seat
 * count. On success we `redirect()` (a NEXT_REDIRECT throw is the
 * signal) to the Stripe-hosted checkout URL. On failure we
 * translate the backend's structured detail codes into
 * plain-English messages so the form renders a friendly banner
 * instead of "HTTP 503".
 *
 * Where Stripe sends the browser afterwards is decided by the backend
 * from its configured web origin, so nothing from the form goes into
 * those URLs.
 */
export async function startCheckoutAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const planCode = String(formData.get("plan_code") ?? "") as PlanChoiceCode;
  const seatCountRaw = String(formData.get("seat_count") ?? "1");
  const seatCount = Math.max(1, Number.parseInt(seatCountRaw, 10) || 1);

  if (!planCode) {
    return { status: "error", message: "Choose a plan first." };
  }

  try {
    const session = await createCheckoutSession({
      plan_code: planCode,
      seat_count: seatCount,
    });
    // Success: hop the browser out to Stripe. `redirect()` throws a
    // NEXT_REDIRECT — the client handles it as a top-level nav.
    redirect(session.url);
  } catch (err) {
    // NEXT_REDIRECT is the signal that `redirect()` succeeded; let
    // it propagate so the framework performs the navigation.
    if (err && (err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    return { status: "error", message: _mapBillingError(err) };
  }
}

/** Send the company to the Stripe Customer Portal to change plan or
 *  seats, update the card, or cancel. Same success (redirect) /
 *  failure (mapped message) contract as startCheckoutAction. */
export async function openPortalAction(
  _prev: BillingActionState,
  _formData: FormData,
): Promise<BillingActionState> {
  try {
    const session = await createPortalSession();
    redirect(session.url);
  } catch (err) {
    if (err && (err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    return { status: "error", message: _mapBillingError(err) };
  }
}

const NOT_SET_UP =
  "Billing isn't set up on this system yet, so nothing can be bought or changed here. Ask your Peregrine contact.";

// Backend surfaces its refusals as specific `detail` strings (see
// services/billing/app/routes/billing.py). Translate each into plain
// English. None of these refusals charges anything: they all happen
// before the browser reaches Stripe.
function _mapBillingError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Couldn't reach billing. Nothing was charged; try again.";
  }
  let detail: string | undefined;
  try {
    const parsed = JSON.parse(err.message);
    if (typeof parsed?.detail === "string") detail = parsed.detail;
  } catch {
    // Non-JSON body — fall through.
  }
  switch (detail) {
    case "stripe_not_configured":
    case "stripe_sdk_not_installed":
    case "web_origin_not_configured":
      return NOT_SET_UP;
    case "already_subscribed":
      return "This company already has a subscription, so a second one can't be started. To change the plan or seats, use Manage billing.";
    case "plan_not_available_for_checkout":
      return "This plan can't be bought here yet. Ask your Peregrine contact.";
    case "seat_count_exceeds_plan_limit":
      return "That's more seats than this plan allows. Choose a bigger plan or fewer seats.";
    case "no_stripe_customer":
      return "There's no subscription to manage yet. Choose a plan first.";
    case "plan_not_found":
      return "That plan no longer exists. Refresh the page and try again.";
    case "stripe_unavailable":
      return "Stripe didn't respond, so nothing was charged or changed. Try again in a minute.";
    case "stripe_refused":
      return "Stripe turned the request down, so nothing was charged or changed. Ask your Peregrine contact to look at the billing log.";
  }
  if (err.status === 401) return "Your session expired — sign in again.";
  if (err.status === 403)
    return "Only an Executive Admin or a Director of Operations can manage billing.";
  return `Billing returned an error (HTTP ${err.status}). Nothing was charged; try again.`;
}
