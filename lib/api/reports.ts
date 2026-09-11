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

// ── PS Form 5500 ─────────────────────────────────────────────────────

export interface PS5500Row {
  route: string;
  origin: string;
  destination: string;
  /** Cancellations included, unlike legacy — which filtered them out
   *  before counting and made completion read better than it was. */
  trips_scheduled: number;
  trips_flown: number;
  trips_cancelled: number;
  /** null when nothing was scheduled. 0% would read as "we flew none
   *  of them", which is a different statement. */
  completion_pct: number | null;
  mail_weight_lbs: number;
  mail_pieces: number;
}

export interface PS5500Report {
  year: number;
  month: number;
  period_label: string;
  rows: PS5500Row[];
  total_trips_scheduled: number;
  total_trips_flown: number;
  total_trips_cancelled: number;
  total_completion_pct: number | null;
  total_mail_weight_lbs: number;
  total_mail_pieces: number;
  draft_manifests_excluded: number;
  advisory: string;
}

// ── CAM ──────────────────────────────────────────────────────────────

export interface CamRow {
  route: string;
  origin: string;
  destination: string;
  scheduled: number;
  completed: number;
  cancelled: number;
  on_time: number;
  late: number;
  /** Completed flights with no recorded arrival. Not on time and not
   *  late — out of the ratio entirely. Legacy counts these as on
   *  time, which awards full marks for flights it never tracked. */
  not_measured: number;
  /** null when nothing on the route could be measured. */
  on_time_pct: number | null;
  completion_pct: number | null;
  mail_weight_lbs: number;
  mail_pieces: number;
}

export interface CamReport {
  year: number;
  month: number;
  period_label: string;
  on_time_threshold_minutes: number;
  rows: CamRow[];
  total_scheduled: number;
  total_completed: number;
  total_cancelled: number;
  total_on_time: number;
  total_late: number;
  total_not_measured: number;
  total_on_time_pct: number | null;
  total_completion_pct: number | null;
  total_mail_weight_lbs: number;
  total_mail_pieces: number;
  draft_manifests_excluded: number;
  advisory: string;
}

// ── USPS Form 5394 ───────────────────────────────────────────────────

export interface Form5394Record {
  flight_date: string;
  flight_number: string;
  tail_number: string;
  origin: string;
  destination: string;
  scheduled_departure: string;
  actual_departure: string | null;
  scheduled_arrival: string;
  actual_arrival: string | null;
  /** Sorted by the service, so two runs of a month agree. */
  mail_classes: string[];
  mail_class_labels: string;
  weight_lbs: number;
  pieces: number;
  status: string;
}

export interface Form5394Report {
  year: number;
  month: number;
  period_label: string;
  records: Form5394Record[];
  total_weight_lbs: number;
  total_pieces: number;
  total_flights: number;
  draft_manifests_excluded: number;
  advisory: string;
}

// ── DOT Form 41 ──────────────────────────────────────────────────────

export interface Dot41AircraftType {
  aircraft_type: string;
  aircraft_count: number;
  flights: number;
  completed: number;
  block_hours: number;
}

export interface Dot41Report {
  year: number;
  quarter: number;
  period_label: string;
  total_flights: number;
  completed: number;
  cancelled: number;
  completion_pct: number | null;
  /** From the flight's own actual times. Legacy sums crew duty
   *  records, so a two-crew leg counts twice. */
  block_hours: number;
  flights_without_times: number;
  /** Times that give an impossible leg — over 24 hours, or arriving
   *  before departing. Excluded from block_hours and counted here,
   *  because one bad timestamp can dominate a quarter. */
  flights_with_implausible_times: number;
  revenue_passengers: number;
  total_passengers: number;
  passenger_weight_lbs: number;
  baggage_weight_lbs: number;
  cargo_weight_lbs: number;
  mail_weight_lbs: number;
  mail_pieces: number;
  /** Integer cents, and quoted rather than invoiced or collected. */
  quoted_revenue_cents: number;
  aircraft_in_fleet: number;
  /** Reported beside the fleet rather than folded into it: a grounded
   *  airframe is still in the fleet for a filing, just not airworthy
   *  today, and one number cannot say both. */
  aircraft_grounded: number;
  aircraft_types: Dot41AircraftType[];
  advisory: string;
}

/** Monthly returns all take the same both-or-neither period. */
function monthQuery(year?: number, month?: number): string {
  return year !== undefined && month !== undefined
    ? `?year=${year}&month=${month}`
    : "";
}

export async function getPS5500Report(
  year?: number,
  month?: number,
): Promise<PS5500Report> {
  return apiFetch<PS5500Report>(
    `/reports/regulatory/ps5500${monthQuery(year, month)}`,
    { cache: "no-store" },
  );
}

export async function getPS5500Csv(
  year: number,
  month: number,
): Promise<string> {
  return apiFetch<string>(
    `/reports/regulatory/ps5500.csv?year=${year}&month=${month}`,
    { parseAs: "text", cache: "no-store" },
  );
}

export async function getCamReport(
  year?: number,
  month?: number,
): Promise<CamReport> {
  return apiFetch<CamReport>(
    `/reports/regulatory/cam${monthQuery(year, month)}`,
    { cache: "no-store" },
  );
}

export async function getCamCsv(year: number, month: number): Promise<string> {
  return apiFetch<string>(
    `/reports/regulatory/cam.csv?year=${year}&month=${month}`,
    { parseAs: "text", cache: "no-store" },
  );
}

export async function getForm5394Report(
  year?: number,
  month?: number,
): Promise<Form5394Report> {
  return apiFetch<Form5394Report>(
    `/reports/regulatory/form5394${monthQuery(year, month)}`,
    { cache: "no-store" },
  );
}

export async function getForm5394Csv(
  year: number,
  month: number,
): Promise<string> {
  return apiFetch<string>(
    `/reports/regulatory/form5394.csv?year=${year}&month=${month}`,
    { parseAs: "text", cache: "no-store" },
  );
}

/** Quarterly, not monthly — so its own both-or-neither pair. */
export async function getDot41Report(
  year?: number,
  quarter?: number,
): Promise<Dot41Report> {
  const qs =
    year !== undefined && quarter !== undefined
      ? `?year=${year}&quarter=${quarter}`
      : "";
  return apiFetch<Dot41Report>(`/reports/regulatory/dot41${qs}`, {
    cache: "no-store",
  });
}

export async function getDot41Csv(
  year: number,
  quarter: number,
): Promise<string> {
  return apiFetch<string>(
    `/reports/regulatory/dot41.csv?year=${year}&quarter=${quarter}`,
    { parseAs: "text", cache: "no-store" },
  );
}
