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

// ── Profitability ────────────────────────────────────────────────────

/** What the figures rest on. Legacy's profitability page reports cost
 *  and nothing about where it came from — with no rates configured its
 *  numbers come from constants compiled into the source, and the page
 *  reads identically either way. */
export interface ProfitBasis {
  flights: number;
  flights_without_hours: number;
  flights_unpriced: number;
  cost_factors_on_file: number;
  hours_from_actual: number;
  hours_from_scheduled: number;
  hours_from_route_estimate: number;
  /** Legs whose recorded times could not be true, so the schedule was
   *  used. One such leg was inflating three reports five-fold. */
  flights_with_impossible_times: number;
}

export interface ProfitRow {
  label: string;
  flights: number;
  completed: number;
  block_hours: number;
  /** Quoted on the bookings — not invoiced and not collected. */
  revenue_cents: number;
  cost_cents: number;
  profit_cents: number;
  /** null when there is no revenue to take a margin of. Zero revenue
   *  with real cost is a loss, not a 0% margin. */
  margin_pct: number | null;
  unpriced: number;
  without_hours: number;
}

export interface ProfitabilityReport {
  year: number;
  month: number;
  period_label: string;
  revenue_cents: number;
  cost_cents: number;
  profit_cents: number;
  margin_pct: number | null;
  block_hours: number;
  cost_per_hour_cents: number | null;
  by_route: ProfitRow[];
  by_aircraft: ProfitRow[];
  basis: ProfitBasis;
  advisory: string;
}

export async function getProfitability(
  year?: number,
  month?: number,
): Promise<ProfitabilityReport> {
  const qs =
    year !== undefined && month !== undefined
      ? `?year=${year}&month=${month}`
      : "";
  return apiFetch<ProfitabilityReport>(`/reports/profitability${qs}`, {
    cache: "no-store",
  });
}

// ── Business intelligence ────────────────────────────────────────────

export interface LoadFactorRow {
  route: string;
  flights: number;
  /** Of `flights`, how many filed a locked manifest. The load factor
   *  is over these only — a flight with no manifest has seats and no
   *  passenger list, so counting it reports an empty aircraft where
   *  the truth is missing paperwork. */
  flights_with_manifest: number;
  seats: number;
  pax: number;
  /** null when no flight on the pair filed a manifest. */
  load_factor_pct: number | null;
  avg_pax_per_flight: number | null;
}

export interface RevenuePerHourRow {
  aircraft_type: string;
  flights: number;
  block_hours: number;
  revenue_cents: number;
  cost_cents: number;
  revenue_per_hour_cents: number | null;
  cost_per_hour_cents: number | null;
  margin_pct: number | null;
  unpriced: number;
  without_hours: number;
}

export interface SeasonalMonth {
  year: number;
  month: number;
  label: string;
  flights: number;
  flights_with_manifest: number;
  pax: number;
  revenue_cents: number;
  load_factor_pct: number | null;
}

export interface TopCustomer {
  customer_id: string;
  name: string;
  revenue_cents: number;
  bookings: number;
  avg_fare_cents: number | null;
}

export interface BiDashboard {
  window_start: string;
  window_end: string;
  months: number;
  load_factor_by_route: LoadFactorRow[];
  revenue_per_hour_by_type: RevenuePerHourRow[];
  seasonal: SeasonalMonth[];
  top_customers: TopCustomer[];
  /** Where route-level margin lives, rather than recomputed here. */
  profitability_path: string;
  advisory: string;
}

/** No period arguments: seasonal demand over one month is not a
 *  pattern, so the service reads a fixed trailing twelve months. */
export async function getBiDashboard(): Promise<BiDashboard> {
  return apiFetch<BiDashboard>("/reports/bi", { cache: "no-store" });
}

// ── Schedule export (SIM / OAG) ────────────────────────────────────

/** What the records *are*, which is what legacy's `target` parameter
 *  was pretending to be. `schedule` is deduplicated recurring services;
 *  `flights` is one row per departure with actuals. */
export type SimBasis = "schedule" | "flights";

export type SimFormat = "csv" | "fixed" | "xml";

export interface SimScheduleRecord {
  carrier: string;
  flight_number: string;
  service_type: string;
  /** The service's own first and last operating date inside the
   *  window — not the window itself. A one-off reports the same date
   *  twice. */
  effective_from: string;
  effective_to: string;
  /** Seven characters, Monday first: the digit on an operating day and
   *  "." otherwise, so position means the day. */
  frequency: string;
  /** Departures backing this record. One means the weekly pattern is
   *  an inference from a single event. */
  operates: number;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  aircraft_type: string | null;
  registration: string;
  seats: number;
}

export interface SimFlightRecord {
  carrier: string;
  flight_number: string;
  service_type: string;
  flight_date: string;
  origin: string;
  destination: string;
  scheduled_departure: string;
  scheduled_arrival: string;
  /** null when the flight has not departed or arrived — not the
   *  scheduled time, which would report a departure that may not have
   *  happened. */
  actual_departure: string | null;
  actual_arrival: string | null;
  aircraft_type: string | null;
  registration: string;
  seats: number;
  /** What was sold — null when no booking row references the flight
   *  at all, which is not a sale of zero. The demo tenant holds eleven
   *  live bookings and none carry a flight_id, so every flight would
   *  otherwise have reported 0 booked. */
  pax_booked: number | null;
  /** Who the captain signed for — null when no manifest was locked,
   *  which is not the same as nobody aboard. */
  pax_manifested: number | null;
  cargo_lbs: number;
  mail_lbs: number;
  status: string;
}

export interface SimExport {
  basis: SimBasis;
  carrier: string;
  start: string;
  end: string;
  schedule: SimScheduleRecord[];
  flights: SimFlightRecord[];
  /** Departures read before deduplication, so the reader can see that
   *  43 flights became 9 services rather than wonder where 34 went. */
  departures: number;
  cancelled: number;
  without_aircraft_type: number;
  /** Flights a booking points at. Zero against a non-empty export is a
   *  data-integration gap, not an empty aircraft. */
  flights_with_booking: number;
  carrying_mail: number;
  truncated_fields: number;
}

export async function getSimExport(
  start: string,
  end: string,
  basis: SimBasis,
): Promise<SimExport> {
  const q = new URLSearchParams({ start, end, basis });
  return apiFetch<SimExport>(`/reports/sim?${q}`, { cache: "no-store" });
}

export async function getSimFile(
  start: string,
  end: string,
  basis: SimBasis,
  format: SimFormat,
): Promise<string> {
  const q = new URLSearchParams({ start, end, basis, format });
  return apiFetch<string>(`/reports/sim/download?${q}`, {
    parseAs: "text",
    cache: "no-store",
  });
}

// ── Data integrity audit ───────────────────────────────────────────

/** A contradiction is records disagreeing with each other or with
 *  physical reality, so at least one is wrong and somebody has to
 *  decide which. An omission is something required that is absent.
 *  The remedy differs — correct versus complete — which is why they
 *  are counted separately. */
export type FindingKind = "contradiction" | "omission";

/** What a finding was computed over. Contradictions are not windowed:
 *  a wrong record does not stop being wrong as it ages, and a review
 *  that only looks at 30 days never looks at anything twice. */
export type FindingScope = "window" | "all_time" | "fleet";

export type CycleStatus = "current" | "due" | "overdue";

export interface IntegrityFinding {
  key: string;
  kind: FindingKind;
  scope: FindingScope;
  label: string;
  /** What it means and what to do about it. Rendered: a count with no
   *  explanation is not reviewable, and the person signing is
   *  accountable for having understood it. */
  detail: string;
  count: number;
  examples: string[];
}

export interface IntegrityAttestation {
  id: string;
  window_start: string;
  window_end: string;
  computed_at: string;
  attested_at: string;
  attested_by_name: string;
  attested_by_role: string;
  /** What was still open at signing. Signing records the review; it
   *  does not clear anything. */
  contradictions_open: number;
  omissions_open: number;
  notes: string;
  findings_hash: string;
}

export interface IntegrityAudit {
  window_start: string;
  window_end: string;
  computed_at: string;
  findings: IntegrityFinding[];
  contradictions: number;
  omissions: number;
  /** Sent back with the signature, so a review signed against a stale
   *  page is refused rather than recorded against figures the reviewer
   *  never saw. */
  findings_hash: string;
  cycle_status: CycleStatus;
  cycle_days: number;
  max_interval_days: number;
  /** Null when no review has ever been recorded — an absence of a
   *  review, not a review at the epoch. */
  last_attested_at: string | null;
  next_due_at: string | null;
  compliance_deadline: string | null;
  days_since_last: number | null;
  recent: IntegrityAttestation[];
  advisory: string;
}

export async function getIntegrityAudit(): Promise<IntegrityAudit> {
  return apiFetch<IntegrityAudit>("/reports/integrity", { cache: "no-store" });
}

export async function postIntegrityAttestation(
  findingsHash: string,
  notes: string,
): Promise<IntegrityAttestation> {
  return apiFetch<IntegrityAttestation>("/reports/integrity/attest", {
    method: "POST",
    body: JSON.stringify({ findings_hash: findingsHash, notes }),
    cache: "no-store",
  });
}

// ── Regulatory records requests (48-hour disclosure) ───────────────

export type RequestorAgency = "faa" | "ntsb" | "other";

export interface DisclosureCategory {
  key: string;
  label: string;
  /** What the file contains. Served rather than duplicated here, so
   *  the form and the bundle's cover sheet cannot disagree. */
  detail: string;
  filename: string;
}

export interface DisclosureExclusion {
  title: string;
  reason: string;
}

export interface DisclosureRecord {
  id: string;
  requestor_name: string;
  requestor_title: string | null;
  requestor_agency: string;
  request_reference: string | null;
  reason: string;
  request_received_at: string;
  period_start: string;
  period_end: string;
  aircraft_tail: string | null;
  categories: string[];
  record_counts: Record<string, number>;
  total_records: number;
  bundle_sha256: string;
  bundle_bytes: number;
  produced_at: string;
  produced_by_name: string;
  produced_by_role: string;
  /** Receipt to production. The compliance fact the 48-hour
   *  commitment is about. */
  hours_to_produce: number;
  within_deadline: boolean;
  notes: string | null;
}

export interface DisclosureCatalogue {
  categories: DisclosureCategory[];
  /** Named on every cover sheet, and on the page, so their absence is
   *  not mistaken for their non-existence. */
  excluded: DisclosureExclusion[];
  deadline_hours: number;
  max_rows: number;
  recent: DisclosureRecord[];
}

export async function getDisclosureCatalogue(): Promise<DisclosureCatalogue> {
  return apiFetch<DisclosureCatalogue>("/reports/disclosure", {
    cache: "no-store",
  });
}
