import Link from "next/link";

import type { ExecutiveSummary } from "@/lib/api/reports";

/**
 * The executive summary, laid out to follow legacy's
 * /reports/executive/summary.
 *
 * Same three bands of KPI cards — Revenue & Profitability, Unit
 * Economics, Operations — over the current-versus-prior comparison
 * table.
 *
 * Legacy has a fourth band, Customers & Loyalty, and two cards inside
 * the first three (30-day forecast, accounts receivable) that read
 * from booking and AR data this service does not expose yet. They are
 * left out rather than stubbed with zeros: a card reading $0 is a
 * claim about the business, and "we have not built this" is not the
 * same claim.
 *
 * Pure presentation, so the whole layout renders under vitest without
 * mocking a fetch.
 */

function money(cents: number): string {
  // The sign goes outside the symbol. Interpolating a negative
  // straight after the "$" renders "$-500", which reads as a typo
  // rather than as a loss.
  const dollars = Math.abs(cents) / 100;
  const body = `$${dollars.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
  return cents < 0 ? `-${body}` : body;
}

/**
 * A change of null means there was nothing to compare against.
 * Rendering that as "+0%" — which legacy does — reads as "flat" beside
 * a number that went from nothing to something.
 */
function changeLabel(pct: number | null, noun = "prior period"): string {
  if (pct === null) return `no ${noun} to compare`;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs ${noun}`;
}

function changeTone(pct: number | null, higherIsBetter = true): string {
  if (pct === null || pct === 0) return "text-muted-foreground";
  const good = higherIsBetter ? pct > 0 : pct < 0;
  return good ? "text-status-green" : "text-status-red";
}

function Band({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="mb-5">
      <h2 className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function Kpi({
  value,
  label,
  note,
  noteTone = "text-muted-foreground",
  tone = "",
}: {
  value: string;
  label: string;
  note?: string;
  noteTone?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className={"text-2xl font-bold tabular-nums " + tone}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      {note ? <p className={"mt-0.5 text-[0.65rem] " + noteTone}>{note}</p> : null}
    </div>
  );
}

function isoRange(start: string, end: string): string {
  const fmt = (iso: string) => {
    // Read the parts rather than parsing — a bare YYYY-MM-DD through
    // new Date() lands at UTC midnight and renders a day early west of
    // Greenwich.
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      timeZone: "UTC",
    });
  };
  const year = start.slice(0, 4);
  return `${fmt(start)} — ${fmt(end)}, ${year}`;
}

export function SummaryView({
  summary,
  controls,
}: {
  summary: ExecutiveSummary;
  controls?: React.ReactNode;
}) {
  const s = summary;
  const priced = s.basis.flights_priced + s.basis.flights_unpriced;
  const costIncomplete =
    s.basis.flights_unpriced > 0 || s.basis.flights_without_duration > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link
        href="/reports"
        className="mb-2 inline-block text-xs font-semibold text-status-blue hover:underline"
      >
        ← Reports
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Executive Summary</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isoRange(s.period_start, s.period_end)} — 60-second snapshot
          </p>
        </div>
        {controls}
      </header>

      {/* The number is only as good as what fed it. A margin computed
          with no cost factors on file is 100%, and saying so beside it
          is what stops that reaching a board pack unchallenged. */}
      {costIncomplete ? (
        <p
          role="status"
          className="mb-5 rounded-lg border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {s.basis.cost_factors_on_file === 0
            ? "No operating-cost factors are on file, so cost and margin below are incomplete. Add them under Settings → Costs."
            : `${s.basis.flights_unpriced} of ${priced} flights could not be costed — cost and margin below are understated.`}
        </p>
      ) : null}

      <Band title="Revenue & Profitability">
        <Kpi
          value={money(s.revenue.cents)}
          label="Revenue MTD"
          tone="text-status-green"
          note={changeLabel(s.revenue.comparison.change_pct, "prior month")}
          noteTone={changeTone(s.revenue.comparison.change_pct)}
        />
        <Kpi
          value={money(s.cost.cents)}
          label="Operating Cost MTD"
          tone="text-status-red"
          note={changeLabel(s.cost.comparison.change_pct, "prior month")}
          // Costs going up is the bad direction.
          noteTone={changeTone(s.cost.comparison.change_pct, false)}
        />
        <Kpi
          value={money(s.profit_cents)}
          label="Profit MTD"
          tone={s.profit_cents >= 0 ? "text-status-green" : "text-status-red"}
          note={
            s.margin_pct === null
              ? "no revenue to margin"
              : `${s.margin_pct}% margin`
          }
        />
      </Band>

      <Band title="Unit Economics">
        <Kpi
          value={
            s.revenue_per_hour_cents === null
              ? "—"
              : money(s.revenue_per_hour_cents)
          }
          label="Revenue / Block Hour"
          tone="text-status-blue"
          note={s.revenue_per_hour_cents === null ? "no hours flown" : undefined}
        />
        <Kpi
          value={
            s.cost_per_hour_cents === null ? "—" : money(s.cost_per_hour_cents)
          }
          label="Cost / Block Hour"
          tone="text-status-red"
          note={s.cost_per_hour_cents === null ? "no hours flown" : undefined}
        />
        <Kpi
          value={`${s.block_hours.toFixed(1)} hrs`}
          label="Block Hours MTD"
          note="actual where flown, scheduled otherwise"
        />
      </Band>

      <Band title="Operations">
        <Kpi
          value={String(s.flights)}
          label="Flights MTD"
          note={changeLabel(s.flights_change_pct, "prior month")}
          noteTone={changeTone(s.flights_change_pct)}
        />
        <Kpi
          value={String(s.pax)}
          label="Passengers MTD"
          note={changeLabel(s.pax_change_pct, "prior month")}
          noteTone={changeTone(s.pax_change_pct)}
        />
        <Kpi
          value={`${s.fleet_total - s.fleet_grounded}/${s.fleet_total}`}
          label="Fleet Available"
          note={s.fleet_grounded > 0 ? `${s.fleet_grounded} grounded` : "none grounded"}
          noteTone={
            s.fleet_grounded > 0 ? "text-status-red" : "text-muted-foreground"
          }
        />
        <Kpi value={String(s.crew_total)} label="Active Crew" />
        <Kpi
          value={String(s.open_squawks)}
          label="Open Squawks"
          tone={s.open_squawks > 0 ? "text-status-yellow" : ""}
        />
      </Band>

      <section
        aria-label="Current against prior period"
        className="overflow-x-auto rounded-xl border border-border bg-card"
      >
        <table className="w-full text-left text-xs">
          <caption className="px-4 pt-3 text-left text-[0.65rem] text-muted-foreground">
            {isoRange(s.period_start, s.period_end)} against{" "}
            {isoRange(s.prior_period_start, s.prior_period_end)} — the same
            span of the prior month, not the whole of it.
          </caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="px-4 py-2 font-semibold">
                Metric
              </th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">
                This period
              </th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">
                Prior period
              </th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            <ComparisonRow
              label="Revenue"
              current={money(s.revenue.cents)}
              prior={money(s.revenue.comparison.prior_cents)}
              pct={s.revenue.comparison.change_pct}
            />
            <ComparisonRow
              label="Operating cost"
              current={money(s.cost.cents)}
              prior={money(s.cost.comparison.prior_cents)}
              pct={s.cost.comparison.change_pct}
              higherIsBetter={false}
            />
            <ComparisonRow
              label="Flights"
              current={String(s.flights)}
              prior="—"
              pct={s.flights_change_pct}
            />
            <ComparisonRow
              label="Passengers"
              current={String(s.pax)}
              prior="—"
              pct={s.pax_change_pct}
            />
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ComparisonRow({
  label,
  current,
  prior,
  pct,
  higherIsBetter = true,
}: {
  label: string;
  current: string;
  prior: string;
  pct: number | null;
  higherIsBetter?: boolean;
}) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <th scope="row" className="px-4 py-2 text-left font-normal">
        {label}
      </th>
      <td className="px-4 py-2 text-right font-semibold tabular-nums">
        {current}
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
        {prior}
      </td>
      <td
        className={
          "px-4 py-2 text-right font-semibold tabular-nums " +
          changeTone(pct, higherIsBetter)
        }
      >
        {/* An em dash, not 0%. There was no prior figure to change
            from, and "0%" asserts that there was. */}
        {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct}%`}
      </td>
    </tr>
  );
}
