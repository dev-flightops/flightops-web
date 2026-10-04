import type { ReactNode } from "react";

import type { Subscription } from "@/lib/api/billing";

/**
 * Dunning banner shown above the CurrentSubscriptionCard when a payment
 * has failed: Stripe is retrying (past due), has stopped retrying
 * (unpaid), never took the first payment (incomplete, expired), or
 * cancelled after its retries failed. Fed by the subscription's status,
 * the mirrored `dunning_attempts` + `next_payment_attempt_at`, and the
 * amount still due on open invoices.
 *
 * Copy is deliberately calm and says nothing about access: the app does
 * not limit a company that hasn't paid (that policy is the client's to
 * set), so the banner only says what Stripe is doing and what is owed.
 *
 * The manage-billing CTA is passed in as a slot rather than imported
 * directly so the banner stays a pure server component
 * (portal-button.tsx transitively pulls in Auth.js, which we don't
 * want in the banner's dependency tree for testing / SSR).
 */
export function DunningBanner({
  subscription,
  billingReady = false,
  canPayOnline = false,
  managePaymentSlot,
}: {
  subscription: Subscription;
  /** Checkout and the Customer portal can run here. Where they can't,
   *  the copy names no action the page doesn't offer: no Manage
   *  billing, and no "choose a plan below". */
  billingReady?: boolean;
  /** An open invoice below links Stripe's page to pay it. */
  canPayOnline?: boolean;
  /** The Manage billing button, shown beside the copy while the
   *  company can still pay through the portal (past due, unpaid,
   *  incomplete) and billing is set up. Never once the subscription
   *  has ended: the way back is choosing a plan again. */
  managePaymentSlot?: ReactNode;
}) {
  const copy = bannerCopy(subscription, billingReady, canPayOnline);
  if (copy === null) {
    return null;
  }
  return (
    <section
      role="alert"
      aria-live="polite"
      className={
        "mb-6 rounded-xl border p-4 " +
        (copy.ended
          ? "border-status-red/40 bg-status-red/5 text-status-red"
          : "border-status-yellow/50 bg-status-yellow/10 text-status-yellow")
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{copy.title}</p>
          <p className="mt-1 text-xs text-foreground/80">{copy.body}</p>
        </div>
        {!copy.ended && billingReady && managePaymentSlot && (
          <div className="flex-shrink-0">{managePaymentSlot}</div>
        )}
      </div>
    </section>
  );
}

function bannerCopy(
  subscription: Subscription,
  billingReady: boolean,
  canPayOnline: boolean,
): { title: string; body: string; ended: boolean } | null {
  const due =
    subscription.amount_due_cents > 0
      ? _money(subscription.amount_due_cents)
      : null;
  const attempts = subscription.dunning_attempts;
  const tried =
    attempts > 0 ? ` (${attempts} attempt${attempts === 1 ? "" : "s"} so far)` : "";
  // Stripe's own invoice page takes a payment whatever this page offers.
  const pay = due && canPayOnline ? " Use Pay on the open invoice below." : "";
  const subscribeAgain = billingReady
    ? " To subscribe again, choose a plan below."
    : " To subscribe again, ask your Peregrine contact: billing isn't set up on this system yet.";
  switch (subscription.status) {
    case "past_due": {
      const retry = subscription.next_payment_attempt_at
        ? ` Stripe will try again on ${_fmtDateTime(subscription.next_payment_attempt_at)}.`
        : "";
      return {
        title: "Payment failed — Stripe is retrying",
        body:
          `We couldn't charge the card on file${due ? ` for ${due}` : ""}${tried}.` +
          retry +
          (billingReady ? " Update the card under Manage billing to keep the subscription." : "") +
          pay,
        ended: false,
      };
    }
    case "unpaid":
      return {
        title: "Payment failed — Stripe has stopped retrying",
        body:
          `${due ? `${due} is due. ` : ""}Stripe tried the card on file${tried} and won't try again.` +
          (billingReady ? " Use Manage billing to update the card and pay what's due." : "") +
          pay,
        ended: false,
      };
    case "incomplete":
      return {
        title: "The first payment didn't go through",
        body:
          `Stripe couldn't take the first payment${due ? ` of ${due}` : ""}.` +
          (billingReady ? " Use Manage billing to update the card." : "") +
          pay,
        ended: false,
      };
    case "incomplete_expired":
      return {
        title: "The subscription didn't start",
        body:
          "The first payment never went through, so Stripe dropped the subscription." +
          subscribeAgain,
        ended: true,
      };
    case "canceled":
      // Only when Stripe cancelled after failed payments. A cancellation
      // the company chose (no failed attempts) needs no alarm.
      if ((attempts ?? 0) === 0) return null;
      return {
        title: "Subscription cancelled — payment could not be recovered",
        body:
          `Stripe cancelled the subscription after its retries failed${due ? `; ${due} is still due` : ""}.` +
          pay +
          subscribeAgain,
        ended: true,
      };
    default:
      return null;
  }
}

function _money(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
