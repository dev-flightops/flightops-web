import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  getAgingReport,
  type AgingReport,
} from "@/lib/api/customer-invoices";
import {
  getAccountingSummary,
  type AccountingSummary,
} from "@/lib/api/reports";

import { money } from "../invoicing/money";
import { PeriodControls } from "./period-controls";

/**
 * /accounting — one month's money, and what is still owed.
 *
 * Legacy's `templates/accounting/dashboard.html` shows revenue, costs,
 * gross margin, one outstanding-AR total, and a payroll liability.
 *
 * THIS IS NOT A GENERAL LEDGER, AND THE PAGE SAYS SO
 *
 * Legacy builds its GL from a journal-entries table and a
 * chart-of-accounts map per accounting package. We have neither, and
 * account codes are the operator's bookkeeper's decision rather than
 * ours. Inventing them would produce a page that looks authoritative
 * and reconciles to nothing.
 *
 * WHY THREE REVENUE FIGURES INSTEAD OF ONE
 *
 * Legacy's dashboard has a single revenue number and a single
 * outstanding-AR number. Ours separates:
 *
 *   Booked      what was sold
 *   Invoiced    what was billed
 *   Collected   what arrived
 *
 * The gaps are the actionable part. Booked above invoiced means
 * flights flown that nobody has raised an invoice for. Invoiced above
 * collected is accounts receivable, broken down by age below. One
 * "revenue" line hides both.
 */

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{1,2}$/;
const YEAR_RE = /^\d{4}$/;

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year: yearParam, month: monthParam } = await searchParams;
  const bothGiven =
    yearParam !== undefined &&
    monthParam !== undefined &&
    YEAR_RE.test(yearParam) &&
    MONTH_RE.test(monthParam) &&
    Number(monthParam) >= 1 &&
    Number(monthParam) <= 12;

  let summary: AccountingSummary | null = null;
  let aging: AgingReport | null = null;
  let loadError: string | null = null;
  // Aging is a separate service from the summary. One failing should
  // cost its own section, not the page — a month-end figure is still
  // worth reading without the AR breakdown beside it.
  let agingError: string | null = null;

  try {
    summary = bothGiven
      ? await getAccountingSummary(Number(yearParam), Number(monthParam))
      : await getAccountingSummary();
  } catch (err) {
    const code = err instanceof ApiError ? err.status : 0;
    loadError =
      code === 403
        ? "Accounting is limited to executive admins and the director of operations."
        : "Could not load the summary just now.";
  }

  try {
    aging = await getAgingReport();
  } catch {
    agingError = "Could not load the aging report just now.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Accounting
          </h1>
          {summary && (
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.period_label} · {summary.block_hours.toFixed(1)} block
              hours
            </p>
          )}
        </div>
        {summary && (
          <PeriodControls year={summary.year} month={summary.month} />
        )}
      </header>

      {loadError ? (
        <p
          role="alert"
          className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red"
        >
          {loadError}
        </p>
      ) : summary ? (
        <>
          <p className="mb-4 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            {summary.note}
          </p>

          {/* The three figures, in the order money moves. */}
          <section
            aria-label="Revenue"
            className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            <Figure
              label="Booked"
              sub="quoted on this month's bookings"
              cents={summary.booked_cents}
            />
            <Figure
              label="Invoiced"
              sub="invoices raised this month"
              cents={summary.invoiced_cents}
            />
            <Figure
              label="Collected"
              sub="payments received this month"
              cents={summary.collected_cents}
            />
          </section>

          {summary.uninvoiced_cents > 0 && (
            // The actionable gap. Flights flown that nobody has billed
            // for, which is a month-end job rather than a statistic.
            <p
              role="status"
              className="mb-4 rounded-md border border-status-yellow/30 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
            >
              <span className="font-semibold">
                {money(summary.uninvoiced_cents)} booked but not invoiced.
              </span>{" "}
              Flights flown with no invoice raised — raise them from the
              flight before closing the month.
            </p>
          )}

          <section
            aria-label="Cost and margin"
            className="mb-2 grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            <Figure label="Cost" sub="modelled from operating rates" cents={summary.cost_cents} />
            <Figure
              label="Profit"
              sub="booked less cost"
              cents={summary.profit_cents}
            />
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Margin
              </div>
              <div className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
                {summary.margin_pct === null ? "—" : `${summary.margin_pct}%`}
              </div>
              <div className="mt-0.5 text-[0.65rem] text-muted-foreground">
                {summary.margin_pct === null
                  ? "nothing booked this month"
                  : "against booked revenue"}
              </div>
            </div>
          </section>

          {(summary.confidence.unpriced_flights > 0 ||
            summary.confidence.unhoured_flights > 0) && (
            // A margin over a month where flights had no cost on file is
            // not a margin. Said next to it rather than buried, so the
            // reader decides whether to trust the number above.
            <p className="mb-6 text-xs text-status-yellow">
              Cost is incomplete:{" "}
              {summary.confidence.unpriced_flights > 0 && (
                <>
                  {summary.confidence.unpriced_flights} of{" "}
                  {summary.confidence.flights} flights have no operating cost
                  configured
                </>
              )}
              {summary.confidence.unpriced_flights > 0 &&
                summary.confidence.unhoured_flights > 0 &&
                "; "}
              {summary.confidence.unhoured_flights > 0 && (
                <>
                  {summary.confidence.unhoured_flights} had their hours inferred
                  from the schedule
                </>
              )}
              . Margin above is only as good as those figures.
            </p>
          )}
        </>
      ) : null}

      {/* ---- AR aging ---- */}
      <section aria-label="Accounts receivable" className="mt-2">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Accounts receivable
        </h2>

        {agingError ? (
          <p
            role="alert"
            className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red"
          >
            {agingError}
          </p>
        ) : aging ? (
          <>
            <p className="mb-3 text-xs text-muted-foreground">{aging.note}</p>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {aging.buckets.map((b) => (
                <div
                  key={b.key}
                  className={
                    "rounded-lg border px-3 py-2.5 " +
                    // Only the oldest band is coloured. Making every
                    // bucket red turns the page into noise and hides
                    // the one that actually needs a phone call.
                    (b.key === "d90_plus" && b.outstanding_cents > 0
                      ? "border-status-red/40 bg-status-red/10"
                      : "border-border bg-card")
                  }
                >
                  <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    {b.label}
                  </div>
                  <div
                    className={
                      "mt-0.5 text-lg font-bold tabular-nums " +
                      (b.key === "d90_plus" && b.outstanding_cents > 0
                        ? "text-status-red"
                        : "text-foreground")
                    }
                  >
                    {money(b.outstanding_cents)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                Total outstanding{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {money(aging.total_outstanding_cents)}
                </span>
              </span>
              {aging.undated_count > 0 && (
                // Counted, not hidden. They cannot be aged, and
                // dropping them would understate what is owed.
                <span className="text-status-yellow">
                  {aging.undated_count} invoice
                  {aging.undated_count === 1 ? "" : "s"} with no due date —{" "}
                  {money(aging.undated_cents)}, not aged
                </span>
              )}
            </div>

            {aging.invoices.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
                Nothing outstanding.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Outstanding invoices as of {aging.as_of}
                  </caption>
                  <thead>
                    <tr className="border-b border-border bg-background/40 text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <th scope="col" className="px-4 py-3">Invoice</th>
                      <th scope="col" className="px-4 py-3">Customer</th>
                      <th scope="col" className="px-4 py-3">Due</th>
                      <th scope="col" className="px-4 py-3 text-right">Days</th>
                      <th scope="col" className="px-4 py-3 text-right">Total</th>
                      <th scope="col" className="px-4 py-3 text-right">Paid</th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Outstanding
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.invoices.map((row) => (
                      <tr
                        key={row.invoice_id}
                        className="border-b border-border last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/invoicing/${row.invoice_id}`}
                            className="font-mono font-semibold text-status-blue hover:underline"
                          >
                            {row.invoice_number}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {row.customer_name ?? (
                            <span className="text-muted-foreground">
                              Walk-in
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                          {row.due_date}
                        </td>
                        <td
                          className={
                            "px-4 py-2.5 text-right tabular-nums " +
                            (row.days_past_due > 90
                              ? "font-semibold text-status-red"
                              : row.days_past_due > 0
                                ? "text-status-yellow"
                                : "text-muted-foreground")
                          }
                        >
                          {row.days_past_due === 0 ? "—" : row.days_past_due}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                          {money(row.total_cents)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                          {row.paid_cents > 0 ? money(row.paid_cents) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                          {money(row.outstanding_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}

function Figure({
  label,
  sub,
  cents,
}: {
  label: string;
  sub: string;
  cents: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
        {money(cents)}
      </div>
      <div className="mt-0.5 text-[0.65rem] text-muted-foreground">{sub}</div>
    </div>
  );
}
