import Link from "next/link";

import { PeriodControls } from "@/components/reports/period-controls";
import { ApiError } from "@/lib/api/client";
import { getProfitability, type ProfitabilityReport } from "@/lib/api/reports";

import { ProfitTable } from "./profit-table";

/**
 * /profitability — revenue against cost, by route and by aircraft.
 *
 * Legacy's `templates/profitability/dashboard.html` heads its two
 * tables "Cost by Route" and "Cost by Aircraft", and that is what they
 * are: flights, hours, estimated cost, cost per hour. There is no
 * revenue column anywhere on a page called Profitability.
 *
 * Its costs are also invented. `cost_model.py` carries per-type
 * fallbacks — Caravan at 65 GPH, fuel at $7.50 a gallon — for when the
 * operator has configured nothing, and its hours default to 1.0 per
 * leg when times are missing. The page reads identically whether the
 * figures came from the operator's own rates or from that table.
 *
 * So this one leads with the basis. Where a rate or a duration is
 * missing it is counted and named rather than filled in, and a row
 * carries its own gaps so a route showing no cost reads as uncosted
 * rather than as free.
 */

export const dynamic = "force-dynamic";

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^\d{1,2}$/;

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "red";
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className={
          "mt-1 text-xl font-semibold tabular-nums " +
          (tone === "red" ? "text-status-red" : "text-foreground")
        }
      >
        {value}
      </p>
      <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{sub}</p>
    </div>
  );
}

export default async function ProfitabilityPage({
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

  let report: ProfitabilityReport | null = null;
  let loadError: string | null = null;

  try {
    report = bothGiven
      ? await getProfitability(Number(yearParam), Number(monthParam))
      : await getProfitability();
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 403
        ? "Profitability is limited to executive admins and the director of operations."
        : "Could not load profitability just now.";
  }

  const b = report?.basis;
  const incomplete =
    b !== undefined &&
    (b.flights_unpriced > 0 ||
      b.flights_without_hours > 0 ||
      b.cost_factors_on_file === 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/reports"
            className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            ← Reports
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Profitability
          </h1>
          {report && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {report.period_label} ·{" "}
              {report.block_hours.toLocaleString("en-US")} block hours
            </p>
          )}
        </div>
        {report && (
          <PeriodControls
            basePath="/profitability"
            label="Reporting period"
            year={report.year}
            month={report.month}
          />
        )}
      </header>

      {loadError ? (
        <p
          role="alert"
          className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red"
        >
          {loadError}
        </p>
      ) : report ? (
        <>
          <p className="mb-4 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            {report.advisory}
          </p>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi
              label="Revenue"
              value={money(report.revenue_cents)}
              sub="quoted on this month's bookings"
            />
            <Kpi
              label="Cost"
              value={money(report.cost_cents)}
              sub="from configured operating rates"
            />
            <Kpi
              label="Profit"
              value={money(report.profit_cents)}
              sub="revenue less direct cost"
              tone={report.profit_cents < 0 ? "red" : undefined}
            />
            <Kpi
              label="Margin"
              value={
                report.margin_pct === null
                  ? "—"
                  : `${report.margin_pct.toFixed(1)}%`
              }
              sub={
                report.margin_pct === null
                  ? "nothing booked this month"
                  : "against booked revenue"
              }
              tone={
                report.margin_pct !== null && report.margin_pct < 0
                  ? "red"
                  : undefined
              }
            />
            {/* A rate, not a total, and that makes zero a different
                claim. "Cost $0" honestly means no cost is known;
                "$0 / hour" says flying costs nothing per hour, which
                is false. So when nothing could be priced this reads
                as unmeasured even though the arithmetic is a clean
                zero.

                Decided here rather than in the service because the
                page already renders the basis this reads from, and
                the service reporting 0/62.61 = 0 is not wrong — it is
                just not worth showing. */}
            <Kpi
              label="Cost / hour"
              value={
                report.cost_per_hour_cents === null ||
                report.cost_cents === 0
                  ? "—"
                  : money(report.cost_per_hour_cents)
              }
              sub={
                report.cost_per_hour_cents === null
                  ? "no hours on file"
                  : report.cost_cents === 0
                    ? "no cost known to divide"
                    : "across the period"
              }
            />
          </div>

          {incomplete && b && (
            // The whole reason this page reads differently from
            // legacy's. A margin computed with no rates on file is
            // 100%, and saying so beside it is what stops that
            // reaching a board pack unchallenged.
            <div
              role="status"
              className="mb-4 rounded-lg border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
            >
              <p className="font-semibold">
                These figures are incomplete, and here is exactly how.
              </p>
              <ul className="mt-1 space-y-0.5">
                {b.cost_factors_on_file === 0 && (
                  <li>
                    No operating-cost rates are configured at all, so every
                    cost below is zero. Add them under Settings → Costs.
                  </li>
                )}
                {b.flights_unpriced > 0 && (
                  <li>
                    {b.flights_unpriced} of {b.flights} flights have no rate
                    for their airframe or no fuel price at their base, and are
                    costed at what is known rather than at a guess.
                  </li>
                )}
                {b.flights_without_hours > 0 && (
                  <li>
                    {b.flights_without_hours}{" "}
                    {b.flights_without_hours === 1 ? "flight has" : "flights have"}{" "}
                    no usable duration, so{" "}
                    {b.flights_without_hours === 1 ? "it contributes" : "they contribute"}{" "}
                    no hours and no cost. The revenue still counts.
                  </li>
                )}
                {b.flights_with_impossible_times > 0 && (
                  <li>
                    {b.flights_with_impossible_times}{" "}
                    {b.flights_with_impossible_times === 1
                      ? "flight has"
                      : "flights have"}{" "}
                    recorded times that cannot be true — longer than a day, or
                    arriving before departing — so the schedule was used
                    instead. Worth correcting in the flight record.
                  </li>
                )}
              </ul>
            </div>
          )}

          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            By route
          </h2>
          <ProfitTable
            caption={`Profitability by route for ${report.period_label}`}
            firstColumn="Route"
            rows={report.by_route}
          />

          <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            By aircraft
          </h2>
          <ProfitTable
            caption={`Profitability by aircraft for ${report.period_label}`}
            firstColumn="Aircraft"
            rows={report.by_aircraft}
          />

          <p className="mt-3 text-xs text-muted-foreground">
            Both tables are ordered by cost, highest first, and show at most
            25 rows. Hours came from{" "}
            {b?.hours_from_actual ?? 0} recorded, {b?.hours_from_scheduled ?? 0}{" "}
            scheduled and {b?.hours_from_route_estimate ?? 0} route-estimate
            figures — a total resting on estimates is a different claim from
            one resting on recorded block times.
          </p>
        </>
      ) : null}
    </div>
  );
}
