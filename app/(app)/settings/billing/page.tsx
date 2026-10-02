import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  type BillingOverviewResponse,
  type Invoice,
  type Plan,
  type Subscription,
  getBillingOverview,
  subscriptionHasEnded,
} from "@/lib/api/billing";

import { ChooseCheckoutButton } from "./checkout-button";
import { DunningBanner } from "./dunning-banner";
import { ManagePaymentButton } from "./portal-button";

/**
 * /settings/billing — Billing & Subscription.
 *
 * Single-fetch page: `GET /billing/overview` returns the company's
 * latest subscription whatever its status (a live one first), the
 * last 12 invoices and the plan catalog in one round trip, so this
 * surface renders without a fetch-storm.
 *
 * The backend admits an Executive Admin and a Director of Operations
 * to every /billing/* endpoint; anyone else gets a 403, which we
 * translate into a "who can see this" panel instead of surfacing the
 * raw HTTP error.
 *
 * What it offers follows the subscription, as Stripe holds it:
 *   - live (active, trial, past due, unpaid, incomplete, paused):
 *     Manage billing, the Stripe Customer portal, for plan and seat
 *     changes, the card and cancelling; never a second checkout,
 *     which would charge twice.
 *   - ended (cancelled, expired) or none: Choose plan.
 * Neither is offered where billing isn't set up (`billing_ready`
 * false: no Stripe key or no web origin); the plan section says so in
 * plain words instead, whatever subscription the mirror holds.
 */
export const dynamic = "force-dynamic";

/** Query-string signals on the return URLs the billing service gives
 *  Stripe for checkout and the portal. Reading them here lets the page render a banner
 *  after the Stripe round-trip so the user has a visible confirmation
 *  they aren't stuck on the same page with no acknowledgement. */
type CheckoutOutcome = "success" | "cancel";
type PortalOutcome = "return";

export default async function SettingsBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; portal?: string }>;
}) {
  const { checkout, portal } = await searchParams;
  const checkoutOutcome: CheckoutOutcome | null =
    checkout === "success" || checkout === "cancel" ? checkout : null;
  const portalOutcome: PortalOutcome | null =
    portal === "return" ? "return" : null;

  let overview: BillingOverviewResponse | null = null;
  let loadError: string | null = null;
  let unauthorized = false;

  try {
    overview = await getBillingOverview();
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        loadError = "Your session expired — please sign in again.";
      } else if (err.status === 403) {
        unauthorized = true;
      } else {
        loadError = "Billing data is unreachable. Try refreshing.";
      }
    } else {
      loadError = "Billing data is unreachable. Try refreshing.";
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumb />
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Billing &amp; Subscription
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plan, seats, billing dates and invoices for this company, as
          Stripe holds them.
        </p>
      </header>

      {checkoutOutcome && <CheckoutOutcomeBanner outcome={checkoutOutcome} />}
      {portalOutcome && <PortalReturnBanner />}

      {unauthorized && <AdminOnlyPanel />}

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      )}

      {overview && (
        <div className="space-y-6">
          {overview.subscription && (
            <DunningBanner
              subscription={overview.subscription}
              managePaymentSlot={
                overview.billing_ready ? <ManagePaymentButton /> : undefined
              }
            />
          )}
          <CurrentSubscriptionCard
            subscription={overview.subscription}
            plans={overview.plans}
            billingReady={overview.billing_ready}
          />
          <InvoiceHistoryCard invoices={overview.invoices} />
          <PlanCatalogCard
            plans={overview.plans}
            subscription={overview.subscription}
            billingReady={overview.billing_ready}
          />
        </div>
      )}
    </div>
  );
}

function CurrentSubscriptionCard({
  subscription,
  plans,
  billingReady,
}: {
  subscription: Subscription | null;
  plans: Plan[];
  billingReady: boolean;
}) {
  if (!subscription) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-8 text-sm">
        <h2 className="text-base font-semibold text-foreground">
          No subscription yet
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          This company has no subscription on file. The plans are listed
          below.
        </p>
      </section>
    );
  }
  const plan = plans.find((p) => p.code === subscription.plan_code);
  const statusPill = _statusPill(subscription.status);
  const ended = subscriptionHasEnded(subscription);
  const seatSummary =
    !ended && plan?.seat_limit !== null && plan?.seat_limit !== undefined
      ? `${subscription.seat_count} of ${plan.seat_limit} seat${plan.seat_limit === 1 ? "" : "s"}`
      : `${subscription.seat_count} seat${subscription.seat_count === 1 ? "" : "s"}`;
  const monthlyDollars = plan
    ? _dollars(plan.monthly_price_cents * subscription.seat_count)
    : "—";
  const amountDue =
    subscription.amount_due_cents > 0
      ? _dollars(subscription.amount_due_cents)
      : null;
  const endedOn = subscription.canceled_at ?? subscription.current_period_end;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {ended ? "Last subscription" : "Current subscription"}
          </p>
          <h2 className="mt-1 text-xl font-bold text-foreground">
            {subscription.plan_name}
          </h2>
        </div>
        <span
          className={
            "rounded border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
            statusPill.className
          }
        >
          {statusPill.label}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        {ended ? (
          <>
            <Stat label="Seats" value={seatSummary} />
            <Stat label="Ended" value={_fmtDate(endedOn)} />
          </>
        ) : (
          <>
            <Stat label="Monthly (this billing period)" value={monthlyDollars} />
            <Stat label="Seats" value={seatSummary} />
            <Stat
              label="Period start"
              value={_fmtDate(subscription.current_period_start)}
            />
            <Stat
              label={subscription.cancel_at_period_end ? "Ends" : "Renews"}
              value={_fmtDate(subscription.current_period_end)}
            />
          </>
        )}
        {amountDue && <Stat label="Amount due" value={amountDue} />}
      </dl>
      {ended ? (
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
          {subscription.status === "incomplete_expired"
            ? "The first payment never went through, so this subscription didn't start."
            : `This subscription ended on ${_fmtDate(endedOn)}.`}{" "}
          To subscribe again, choose a plan below.
        </p>
      ) : (
        <>
          {subscription.cancel_at_period_end && (
            <div
              role="status"
              className="mt-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
            >
              Cancels at end of current period. No further invoices will be
              generated after {_fmtDate(subscription.current_period_end)}.
            </div>
          )}
          {billingReady && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
              <ManagePaymentButton />
              <span className="text-[0.65rem] text-muted-foreground">
                Change plan or seats, update the card, or cancel, in the
                Stripe Customer portal.
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function InvoiceHistoryCard({ invoices }: { invoices: Invoice[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Invoice history
          </p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            Last {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
          </h2>
        </div>
      </div>
      {invoices.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No invoices have been issued for this tenant yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-[0.65rem] uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-semibold">Number</th>
                <th className="px-2 py-2 font-semibold">Period</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 text-right font-semibold">Amount</th>
                <th className="px-2 py-2 font-semibold">Paid</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => {
                const pill = _invoiceStatusPill(inv.status);
                return (
                  <tr key={inv.id} className="hover:bg-accent">
                    <td className="px-2 py-2 font-mono text-xs">
                      {inv.number ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">
                      {_fmtRange(inv.period_start, inv.period_end)}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={
                          "rounded border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider " +
                          pill.className
                        }
                      >
                        {pill.label}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono">
                      {_dollars(inv.amount_due_cents)} {inv.currency}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">
                      {inv.paid_at ? _fmtDate(inv.paid_at) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {inv.invoice_pdf_url ? (
                        <a
                          href={inv.invoice_pdf_url}
                          target="_blank"
                          rel="noopener"
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          ↓ PDF
                        </a>
                      ) : inv.hosted_invoice_url ? (
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener"
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          View →
                        </a>
                      ) : (
                        <span className="text-[0.65rem] text-muted-foreground">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PlanCatalogCard({
  plans,
  subscription,
  billingReady,
}: {
  plans: Plan[];
  subscription: Subscription | null;
  billingReady: boolean;
}) {
  const sorted = [...plans].sort(
    (a, b) => a.monthly_price_cents - b.monthly_price_cents,
  );
  // A live subscription changes plan in the portal; a second checkout
  // beside it would charge twice.
  const live = subscription !== null && !subscriptionHasEnded(subscription);
  const anyForSale = billingReady && plans.some((p) => p.checkout_available);
  const offerCheckout = billingReady && !live;
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Plan catalog
      </p>
      <h2 className="mt-1 mb-4 text-base font-semibold text-foreground">
        Available tiers
      </h2>
      {!billingReady ? (
        <p
          role="note"
          className="mb-4 rounded-md border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground"
        >
          Billing isn&rsquo;t set up on this system yet, so plans
          can&rsquo;t be bought or changed here. Ask your Peregrine
          contact.
        </p>
      ) : live ? (
        <p role="note" className="mb-4 text-xs text-muted-foreground">
          To change the plan or the number of seats, use Manage billing
          above.
        </p>
      ) : (
        !anyForSale && (
          <p
            role="note"
            className="mb-4 rounded-md border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground"
          >
            No plan can be bought here yet. Ask your Peregrine contact.
          </p>
        )
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {sorted.map((plan) => {
          const isCurrent = live && plan.code === subscription?.plan_code;
          return (
            <div
              key={plan.id}
              className={
                "rounded-lg border p-4 " +
                (isCurrent
                  ? "border-primary/60 bg-primary/5"
                  : "border-border bg-background/50")
              }
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-foreground">
                  {plan.name}
                </span>
                {isCurrent && (
                  <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Current
                  </span>
                )}
              </div>
              <div className="mb-2 font-mono text-lg text-foreground">
                {_dollars(plan.monthly_price_cents)}
                <span className="ml-1 text-[0.65rem] text-muted-foreground">
                  /mo · {plan.currency}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {plan.description ??
                  (plan.seat_limit !== null
                    ? `Up to ${plan.seat_limit} seat${plan.seat_limit === 1 ? "" : "s"}.`
                    : "No seat limit.")}
              </p>
              {offerCheckout && plan.checkout_available && (
                <ChooseCheckoutButton
                  planCode={plan.code as "starter" | "growth" | "scale"}
                  defaultSeatCount={1}
                  seatLimit={plan.seat_limit}
                />
              )}
              {offerCheckout && anyForSale && !plan.checkout_available && (
                <p className="mt-2 text-[0.6rem] italic text-muted-foreground">
                  Not available to buy here yet.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CheckoutOutcomeBanner({ outcome }: { outcome: CheckoutOutcome }) {
  // Post-Stripe-redirect signal set by our own success_url /
  // cancel_url. The subscription row itself is written by the
  // Slice 3 webhook, so on `success` we say "processing" instead
  // of "confirmed" — the page will show the real subscription
  // once the webhook lands and the next reload picks it up.
  if (outcome === "success") {
    return (
      <div
        role="status"
        className="mb-4 rounded-md border border-status-green/40 bg-status-green/10 px-4 py-3 text-sm text-status-green"
      >
        <p className="font-semibold">Checkout complete — processing your subscription.</p>
        <p className="mt-0.5 text-xs text-foreground/80">
          Stripe is notifying us; refresh this page in a few seconds
          to see the new plan on your Current subscription card.
        </p>
      </div>
    );
  }
  return (
    <div
      role="status"
      className="mb-4 rounded-md border border-border/60 bg-muted/60 px-4 py-3 text-sm text-muted-foreground"
    >
      Checkout was cancelled — nothing charged. Pick a plan below when
      you&rsquo;re ready.
    </div>
  );
}

function PortalReturnBanner() {
  return (
    <div
      role="status"
      className="mb-4 rounded-md border border-border/60 bg-muted/60 px-4 py-3 text-sm text-muted-foreground"
    >
      Welcome back from the Stripe portal. If you made a change, it
      may take a few seconds for the update to reach this page —
      refresh if the numbers look stale.
    </div>
  );
}

function AdminOnlyPanel() {
  return (
    <section className="mb-6 rounded-xl border border-status-yellow/40 bg-status-yellow/10 px-5 py-6 text-sm">
      <h2 className="text-base font-semibold text-status-yellow">
        Billing is restricted
      </h2>
      <p className="mt-1 text-xs text-foreground/80">
        Only an Executive Admin or a Director of Operations can see
        billing. Ask one of them if you need the plan or invoices.
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}

function Breadcrumb() {
  return (
    <nav className="mb-4 text-xs text-muted-foreground">
      <Link href="/settings" className="hover:text-foreground">
        Settings
      </Link>
      <span className="px-1.5">/</span>
      <span className="text-foreground">Billing</span>
    </nav>
  );
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Past due",
  unpaid: "Unpaid",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  canceled: "Cancelled",
  paused: "Paused",
};

function _statusPill(status: string): { label: string; className: string } {
  const label = STATUS_LABELS[status] ?? status;
  switch (status) {
    case "active":
    case "trialing":
      return {
        label,
        className: "border-status-green/40 bg-status-green/10 text-status-green",
      };
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "paused":
      return {
        label,
        className:
          "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
      };
    case "canceled":
    case "incomplete_expired":
      return {
        label,
        className: "border-status-red/40 bg-status-red/10 text-status-red",
      };
    default:
      return {
        label,
        className: "border-border bg-muted text-muted-foreground",
      };
  }
}

function _invoiceStatusPill(status: string): { label: string; className: string } {
  switch (status) {
    case "paid":
      return {
        label: "Paid",
        className: "border-status-green/40 bg-status-green/10 text-status-green",
      };
    case "open":
      return {
        label: "Open",
        className: "border-status-blue/40 bg-status-blue/10 text-status-blue",
      };
    case "uncollectible":
      return {
        label: "Uncollectible",
        className: "border-status-red/40 bg-status-red/10 text-status-red",
      };
    case "void":
      return {
        label: "Void",
        className: "border-border bg-muted text-muted-foreground",
      };
    case "draft":
      return {
        label: "Draft",
        className: "border-border bg-muted text-muted-foreground",
      };
    default:
      return {
        label: status,
        className: "border-border bg-muted text-muted-foreground",
      };
  }
}

function _dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function _fmtDate(iso: string | null): string {
  if (iso === null) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function _fmtRange(start: string | null, end: string | null): string {
  if (start === null || end === null) return "—";
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const startStr = s.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endStr = e.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startStr} → ${endStr}`;
}
