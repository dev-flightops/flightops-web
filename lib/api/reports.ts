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

// ── Regulatory: T-100 ────────────────────────────────────────────────

export interface T100Row {
  origin: string;
  destination: string;
  mail_class: string;
  mail_class_label: string;
  /** Distinct flights, not cargo lines. One flight carrying two bypass
   *  lines is one departure. */
  departures: number;
  weight_lbs: number;
  pieces: number;
}

export interface T100Report {
  year: number;
  month: number;
  period_label: string;
  rows: T100Row[];
  total_weight_lbs: number;
  total_pieces: number;
  /** Distinct flights across the month — deliberately not the sum of
   *  the per-row departures, which counts a flight once per class. */
  total_departures: number;
  /** Manifests still in draft for flights in this month, whose cargo
   *  is excluded. Shown so a filer knows the report is provisional. */
  draft_manifests_excluded: number;
  advisory: string;
}

/** Both or neither: the service fills in the month just gone when
 *  neither is given, and half a period would report a month nobody
 *  asked for. */
export async function getT100Report(
  year?: number,
  month?: number,
): Promise<T100Report> {
  const qs =
    year !== undefined && month !== undefined
      ? `?year=${year}&month=${month}`
      : "";
  return apiFetch<T100Report>(`/reports/regulatory/t100${qs}`, {
    cache: "no-store",
  });
}

/** The CSV as text, built server-side from the same report the table
 *  renders so the filed file and the reviewed figures cannot differ. */
export async function getT100Csv(
  year: number,
  month: number,
): Promise<string> {
  return apiFetch<string>(
    `/reports/regulatory/t100.csv?year=${year}&month=${month}`,
    { parseAs: "text", cache: "no-store" },
  );
}

// ── Daily ops score ─────────────────────────────────────────────────

export interface OpsScorePillar {
  key: string;
  label: string;
  score: number;
  max: number;
  /** Why it scored as it did, built from the counts. */
  context: string;
  /** What this pillar could not measure. Rendered, so a partial
   *  measurement never passes for a complete one. */
  not_measured: string | null;
}

export interface OpsScoreResponse {
  as_of: string;
  score: number;
  /** The best score achievable given what can currently be measured.
   *  Less than 100 while any pillar has an unmeasurable share — shown
   *  so a reader can tell "we scored badly" from "we cannot score
   *  this". */
  max_achievable: number;
  band: string;
  pillars: OpsScorePillar[];
  advisory: string;
}

/**
 * The day's score, computed server-side.
 *
 * The page used to compute three pillars itself and render the other
 * two as a hardcoded 0 — 30 of 100 points nothing could move, so a
 * flawless day scored 70 and read "Fair". One formula, one place.
 *
 * `timezone` decides which day is scored: the operator's, not the
 * server's.
 */
export async function getOpsScore(
  timezone?: string,
): Promise<OpsScoreResponse> {
  const qs = timezone ? `?timezone=${encodeURIComponent(timezone)}` : "";
  return apiFetch<OpsScoreResponse>(`/reports/ops-score${qs}`, {
    cache: "no-store",
  });
}

// ── Monthly accounting summary ───────────────────────────────────────

export interface CostConfidence {
  flights: number;
  /** Flights with no operating cost configured for their aircraft. */
  unpriced_flights: number;
  /** Flights whose hours were inferred from the schedule rather than
   *  measured or route-estimated. */
  unhoured_flights: number;
}

export interface AccountingSummary {
  year: number;
  month: number;
  period_label: string;
  period_start: string;
  period_end: string;
  /** What was sold — quoted totals on the month's bookings. */
  booked_cents: number;
  /** What was billed — invoices raised in the month, voids excluded. */
  invoiced_cents: number;
  /** What arrived — payments received in the month, by the date the
   *  money landed rather than the invoice's date. */
  collected_cents: number;
  cost_cents: number;
  profit_cents: number;
  margin_pct: number | null;
  /** Booked less invoiced: flights flown with no invoice raised. The
   *  number somebody acts on at month end. */
  uninvoiced_cents: number;
  block_hours: number;
  confidence: CostConfidence;
  note: string;
}

/** Both or neither — the service fills in the month just gone when
 *  neither is given, and half a period would report a month nobody
 *  asked for. */
export async function getAccountingSummary(
  year?: number,
  month?: number,
): Promise<AccountingSummary> {
  const qs =
    year !== undefined && month !== undefined
      ? `?year=${year}&month=${month}`
      : "";
  return apiFetch<AccountingSummary>(`/reports/accounting/summary${qs}`, {
    cache: "no-store",
  });
}
