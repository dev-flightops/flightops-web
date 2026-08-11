import type { ReactNode } from "react";

import type { Subscription } from "@/lib/api/billing";

/**
 * Dunning banner shown above the CurrentSubscriptionCard when Stripe
 * is retrying a failed charge for this tenant. Fed by the mirrored
 * `dunning_attempts` + `next_payment_attempt_at` fields the backend
 * populates on `invoice.payment_failed` webhooks (Slice A).
 *
 * Copy is deliberately calm — the tenant still has service (Stripe
 * doesn't cancel until it exhausts retries), so we want them to
 * update their card without panic.
 *
 * The manage-payment CTA is passed in as a slot rather than
 * imported directly so the banner stays a pure server component
 * (portal-button.tsx transitively pulls in Auth.js, which we don't
 * want in the banner's dependency tree for testing / SSR).
 */
export function DunningBanner({
  subscription,
  managePaymentSlot,
}: {
  subscription: Subscription;
  /** Rendered next to the copy when the tenant can still self-heal
   *  (past_due / unpaid). Omitted on the canceled variant because
   *  the portal is no longer the right recovery path. */
  managePaymentSlot?: ReactNode;
}) {
  if (!isDunning(subscription)) {
    return null;
  }
  const nextRetry = subscription.next_payment_attempt_at;
  const attempts = subscription.dunning_attempts;
  const isCanceled =
    subscription.status === "canceled" ||
    subscription.status === "incomplete_expired";
  return (
    <section
      role="alert"
      aria-live="polite"
      className={
        "mb-6 rounded-xl border p-4 " +
        (isCanceled
          ? "border-status-red/40 bg-status-red/5 text-status-red"
          : "border-status-yellow/50 bg-status-yellow/10 text-status-yellow")
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {isCanceled
              ? "Subscription canceled — payment could not be recovered"
              : "Payment failed — Stripe is retrying"}
          </p>
          <p className="mt-1 text-xs text-foreground/80">
            {isCanceled ? (
              <>
                Your subscription was canceled after Stripe exhausted
                retry attempts. Access continues through the end of the
                current billing period. Choose a plan below to resume
                service.
              </>
            ) : (
              <>
                We couldn&rsquo;t charge the card on file
                {attempts > 0 ? ` (${attempts} attempt${attempts === 1 ? "" : "s"} so far)` : ""}
                {nextRetry ? ` — Stripe will retry on ${_fmtDateTime(nextRetry)}` : ""}.
                Update your card via Manage payment to keep service
                uninterrupted.
              </>
            )}
          </p>
        </div>
        {!isCanceled && managePaymentSlot && (
          <div className="flex-shrink-0">{managePaymentSlot}</div>
        )}
      </div>
    </section>
  );
}

function isDunning(subscription: Subscription): boolean {
  const dunningStatuses = new Set([
    "past_due",
    "unpaid",
    "incomplete",
    "incomplete_expired",
  ]);
  if (dunningStatuses.has(subscription.status)) return true;
  // Also surface the banner when Stripe canceled the sub due to
  // exhausted retries — the canceled_at is stamped but the tenant
  // may not realize why.
  if (
    subscription.status === "canceled" &&
    (subscription.dunning_attempts ?? 0) > 0
  ) {
    return true;
  }
  return false;
}

function _fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
