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
 */
export async function startCheckoutAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const planCode = String(formData.get("plan_code") ?? "") as PlanChoiceCode;
  const seatCountRaw = String(formData.get("seat_count") ?? "1");
  const seatCount = Math.max(1, Number.parseInt(seatCountRaw, 10) || 1);
  const successPath = String(formData.get("success_path") ?? "/settings/billing");
  const cancelPath = String(formData.get("cancel_path") ?? "/settings/billing");
  const origin = String(formData.get("origin") ?? "");

  if (!planCode || !origin) {
    return { status: "error", message: "Missing plan or origin." };
  }

  try {
    const session = await createCheckoutSession({
      plan_code: planCode,
      seat_count: seatCount,
      success_url: `${origin}${successPath}?checkout=success`,
      cancel_url: `${origin}${cancelPath}?checkout=cancel`,
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

/** Send the tenant to the Stripe Customer Portal to update payment
 *  method or cancel. Same success (redirect) / failure (mapped
 *  message) contract as startCheckoutAction. */
export async function openPortalAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const returnPath = String(formData.get("return_path") ?? "/settings/billing");
  const origin = String(formData.get("origin") ?? "");
  if (!origin) return { status: "error", message: "Missing origin." };
  try {
    const session = await createPortalSession(
      `${origin}${returnPath}?portal=return`,
    );
    redirect(session.url);
  } catch (err) {
    if (err && (err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    return { status: "error", message: _mapBillingError(err) };
  }
}

// Backend surfaces validation errors as specific `detail` strings
// (see services/billing/app/routes/billing.py). Translate the ones a
// billing admin would actually hit into plain English.
function _mapBillingError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Couldn't reach billing-service. Try again.";
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
      return "Checkout isn't available on this deployment yet — Stripe hasn't been configured. Ask your Peregrine contact.";
    case "already_subscribed":
      return "You already have an active subscription. Use Manage payment to change plans or seat count.";
    case "plan_not_available_for_checkout":
      return "This plan isn't wired for checkout yet — Stripe price id missing.";
    case "seat_count_exceeds_plan_limit":
      return "That seat count is above the plan's limit. Pick a higher tier or reduce seats.";
    case "no_stripe_customer":
      return "No Stripe customer on file yet — start a subscription first via Choose plan.";
    case "plan_not_found":
      return "Plan not found. Refresh the page and try again.";
  }
  if (err.status === 401) return "Your session expired — sign in again.";
  if (err.status === 403) return "You don't have permission to manage billing.";
  return `Backend returned HTTP ${err.status}.`;
}
