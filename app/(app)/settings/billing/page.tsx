import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  type BillingOverviewResponse,
  type Invoice,
  type Plan,
  type Subscription,
  getBillingOverview,
} from "@/lib/api/billing";

import { ChooseCheckoutButton } from "./checkout-button";
import { ManagePaymentButton } from "./portal-button";

/**
 * /settings/billing — Billing & Subscription reader (Slice 1).
 *
 * Single-fetch page: `GET /billing/overview` returns the active
 * subscription + last 12 invoices + full plan catalog in one round
 * trip, so this surface renders without a fetch-storm.
 *
 * Backend gates every /billing/* endpoint on Role.EXEC_ADMIN — a
 * chief_pilot or pilot hitting this page gets a 403 which we
 * translate into an "admin-only" empty state instead of surfacing
 * the raw HTTP error.
 *
 * Slice 1 = READ-ONLY: current plan, seat count, next billing
 * date, invoice history + PDF links, and the plan catalog for
 * reference. Slice 2 (separate PR) ships Choose Plan / Change Seat
 * Count / Portal-manage-payment via the Stripe SDK + webhooks.
 */
export const dynamic = "force-dynamic";

export default async function SettingsBillingPage() {
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
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Breadcrumb />
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Billing &amp; Subscription
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Current plan, seat utilization, and invoice history for this
          tenant. Plan changes + payment method land in the next slice.
        </p>
      </header>

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
          <CurrentSubscriptionCard
            subscription={overview.subscription}
            plans={overview.plans}
          />
          <InvoiceHistoryCard invoices={overview.invoices} />
          <PlanCatalogCard
            plans={overview.plans}
            currentPlanCode={overview.subscription?.plan_code ?? null}
          />
        </div>
      )}
    </div>
  );
}

function CurrentSubscriptionCard({
  subscription,
  plans,
}: {
  subscription: Subscription | null;
  plans: Plan[];
}) {
  if (!subscription) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-8 text-sm">
        <h2 className="text-base font-semibold text-foreground">
          No active subscription
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          This tenant has no live subscription on file. Choose a plan
          from the catalog below once billing checkout ships in the
          next slice.
        </p>
      </section>
    );
  }
  const plan = plans.find((p) => p.code === subscription.plan_code);
  const statusPill = _statusPill(subscription.status);
  const seatSummary =
    plan?.seat_limit !== null && plan?.seat_limit !== undefined
      ? `${subscription.seat_count} of ${plan.seat_limit} seat${plan.seat_limit === 1 ? "" : "s"}`
      : `${subscription.seat_count} seat${subscription.seat_count === 1 ? "" : "s"}`;
  const monthlyDollars = plan
    ? _dollars(plan.monthly_price_cents * subscription.seat_count)
    : "—";

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Current subscription
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
        <Stat label="Monthly (this billing period)" value={monthlyDollars} />
        <Stat label="Seats" value={seatSummary} />
        <Stat
          label="Period start"
          value={_fmtDate(subscription.current_period_start)}
        />
        <Stat
          label="Renews / expires"
          value={_fmtDate(subscription.current_period_end)}
        />
      </dl>
      {subscription.cancel_at_period_end && (
        <div
          role="status"
          className="mt-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          Cancels at end of current period. No further invoices will be
          generated after {_fmtDate(subscription.current_period_end)}.
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <ManagePaymentButton />
        <span className="text-[0.65rem] text-muted-foreground">
          Update card, change seat count, or cancel via the Stripe
          Customer Portal.
        </span>
      </div>
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
                  <tr key={inv.id} className="hover:bg-muted/5">
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
                      {_dollarsFromMajor(inv.amount_paid_major)} {inv.currency}
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
                          className="text-xs font-semibold text-status-blue hover:underline"
                        >
                          ↓ PDF
                        </a>
                      ) : inv.hosted_invoice_url ? (
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener"
                          className="text-xs font-semibold text-status-blue hover:underline"
                        >
                          View →
                        </a>
                      ) : (
                        <span className="text-[0.65rem] text-muted-foreground/60">
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
  currentPlanCode,
}: {
  plans: Plan[];
  currentPlanCode: string | null;
}) {
  const sorted = [...plans].sort(
    (a, b) => a.monthly_price_cents - b.monthly_price_cents,
  );
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Plan catalog
      </p>
      <h2 className="mt-1 mb-4 text-base font-semibold text-foreground">
        Available tiers
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {sorted.map((plan) => {
          const isCurrent = plan.code === currentPlanCode;
          return (
            <div
              key={plan.id}
              className={
                "rounded-lg border p-4 " +
                (isCurrent
                  ? "border-status-blue/60 bg-status-blue/5"
                  : "border-border bg-background/50")
              }
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-foreground">
                  {plan.name}
                </span>
                {isCurrent && (
                  <span className="rounded border border-status-blue/40 bg-status-blue/10 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-status-blue">
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
              <div className="mb-2 text-[0.65rem] text-muted-foreground">
                {plan.seat_limit !== null
                  ? `Up to ${plan.seat_limit} seat${plan.seat_limit === 1 ? "" : "s"}`
                  : "Unlimited seats"}
              </div>
              {plan.description && (
                <p className="text-xs text-muted-foreground">
                  {plan.description}
                </p>
              )}
              {!isCurrent && plan.checkout_available && (
                <ChooseCheckoutButton
                  planCode={plan.code as "starter" | "growth" | "scale"}
                  defaultSeatCount={1}
                  seatLimit={plan.seat_limit}
                />
              )}
              {!isCurrent && !plan.checkout_available && (
                <p className="mt-2 text-[0.6rem] italic text-muted-foreground/70">
                  Checkout not yet wired for this plan — Stripe price
                  id missing.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AdminOnlyPanel() {
  return (
    <section className="mb-6 rounded-xl border border-status-yellow/40 bg-status-yellow/10 px-5 py-6 text-sm">
      <h2 className="text-base font-semibold text-status-yellow">
        Admin access required
      </h2>
      <p className="mt-1 text-xs text-foreground/80">
        Billing information is restricted to exec-admin users. Ask your
        FlightOps administrator for read access if you need to see plan
        or invoice details.
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

function _statusPill(status: string): { label: string; className: string } {
  switch (status) {
    case "active":
    case "trialing":
      return {
        label: status,
        className: "border-status-green/40 bg-status-green/10 text-status-green",
      };
    case "past_due":
    case "unpaid":
      return {
        label: status,
        className:
          "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
      };
    case "canceled":
    case "incomplete_expired":
      return {
        label: status,
        className: "border-status-red/40 bg-status-red/10 text-status-red",
      };
    default:
      return {
        label: status,
        className: "border-border bg-muted/40 text-muted-foreground",
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
        className: "border-border bg-muted/40 text-muted-foreground opacity-70",
      };
    case "draft":
      return {
        label: "Draft",
        className: "border-border bg-muted/40 text-muted-foreground",
      };
    default:
      return {
        label: status,
        className: "border-border bg-muted/40 text-muted-foreground",
      };
  }
}

function _dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function _dollarsFromMajor(major: string): string {
  const n = Number(major);
  return `$${n.toLocaleString(undefined, {
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
