/**
 * Typed wrapper for the reports-service endpoints on the ops gateway.
 * Router is mounted at /reports on the gateway (see
 * flightops-services/infra/nginx/dev.conf).
 */

import { apiFetch } from "./client";

export interface PeriodComparison {
  prior_cents: number;
  /** Null when there is no prior figure. Legacy sends 0, which renders
   *  as "no change" beside a number that went from nothing to
   *  something. */
  change_pct: number | null;
}

export interface Money {
  cents: number;
  comparison: PeriodComparison;
}

/**
 * What the cost total actually rests on. A cost figure with no factors
 * behind it reports a 100% margin — the most flattering possible wrong
 * answer — so the page shows the gap rather than the number alone.
 */
export interface CostBasis {
  flights_priced: number;
  flights_unpriced: number;
  flights_without_duration: number;
  cost_factors_on_file: number;
  fuel_prices_on_file: number;
}

export interface ExecutiveSummary {
  period_start: string;
  period_end: string;
  prior_period_start: string;
  prior_period_end: string;
  revenue: Money;
  cost: Money;
  profit_cents: number;
  margin_pct: number | null;
  flights: number;
  flights_change_pct: number | null;
  pax: number;
  pax_change_pct: number | null;
  block_hours: number;
  revenue_per_hour_cents: number | null;
  cost_per_hour_cents: number | null;
  fleet_total: number;
  fleet_grounded: number;
  crew_total: number;
  open_squawks: number;
  basis: CostBasis;
}

export async function getExecutiveSummary(
  timezone?: string,
): Promise<ExecutiveSummary> {
  const qs = timezone ? `?timezone=${encodeURIComponent(timezone)}` : "";
  return apiFetch<ExecutiveSummary>(`/reports/executive/summary${qs}`, {
    cache: "no-store",
  });
}
