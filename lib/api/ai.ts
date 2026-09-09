/**
 * Typed wrapper for the ai-service endpoints on the ops gateway.
 * Router is mounted at /ai on the gateway (see
 * flightops-services/infra/nginx/dev.conf).
 */

import { apiFetch } from "./client";

/** Matches the palette the rest of the app uses for status, so a red
 *  badge here means what a red chip means on the fleet board. */
export type BadgeColor = "green" | "amber" | "red" | "blue" | "grey";

export interface FleetBrainBadge {
  text: string;
  color: BadgeColor;
}

/** What the classifier understood. Returned alongside the answer so a
 *  wrong answer can be traced to a wrong reading rather than guessed
 *  at. */
export interface FleetBrainIntent {
  intent_type: string;
  params: Record<string, unknown>;
  confidence: number;
  raw_query: string;
}

export interface FleetBrainAnswer {
  summary: string;
  columns: string[];
  /** Keyed by the column label exactly — the API builds both, so the
   *  table needs no key-munging to line them up. */
  rows: Array<Record<string, string | number>>;
  badges: FleetBrainBadge[];
  suggestions: string[];
  intent_type: string;
  /** Understood, but we hold no data to answer it. Distinct from not
   *  understanding, and shown differently. */
  unsupported: boolean;
}

export interface FleetBrainReply {
  intent: FleetBrainIntent;
  answer: FleetBrainAnswer;
}

export async function askFleetBrain(
  query: string,
  timezone?: string,
): Promise<FleetBrainReply> {
  return apiFetch<FleetBrainReply>("/ai/fleetbrain/query", {
    method: "POST",
    body: JSON.stringify({ query, timezone: timezone ?? null }),
    headers: { "Content-Type": "application/json" },
  });
}

export async function getFleetBrainExamples(): Promise<string[]> {
  const data = await apiFetch<{ examples: string[] }>("/ai/fleetbrain/examples");
  return data.examples;
}

// ── Morning brief ────────────────────────────────────────────────────

export interface BriefSegment {
  label: string;
  count: number;
}

export interface BriefAlert {
  text: string;
  severity: "critical" | "warning";
}

export interface MaintenanceDueItem {
  tail: string;
  item: string;
  due: string;
  overdue: boolean;
}

export interface MorningBrief {
  generated_for: string;
  flights: { total: number; active: number; segments: BriefSegment[] };
  fleet: { total: number; segments: BriefSegment[] };
  load_factor: { percent: number; pax: number; seats: number };
  on_time: {
    percent: number;
    completed: number;
    total: number;
    /** Null when there is no prior day to compare against — an arrow
     *  with no history behind it invites a reading the data does not
     *  support. */
    trend: "up" | "down" | "flat" | null;
  };
  revenue: { booked_cents: number; bookings: number };
  crew: { total: number; on_duty: number; non_current: number; grace: number };
  squawks: { open: number; by_severity: Record<string, number> };
  safety: { open: number; by_severity: Record<string, number> };
  maintenance_due: MaintenanceDueItem[];
  alerts: BriefAlert[];
}

export async function getMorningBrief(
  timezone?: string,
): Promise<MorningBrief> {
  const qs = timezone ? `?timezone=${encodeURIComponent(timezone)}` : "";
  return apiFetch<MorningBrief>(`/ai/brief${qs}`, { cache: "no-store" });
}

// ── AI Query ─────────────────────────────────────────────────────────

export interface QueryFilter {
  field: string;
  op: string;
  value: unknown;
}

export interface QueryAggregate {
  fn: string;
  field?: string | null;
  label?: string | null;
}

/**
 * What the model decided to fetch. Returned with the answer for the
 * same reason FleetBrain returns its intent, and the same reason
 * legacy prints the SQL it generated: a wrong answer is only
 * debuggable if the reading behind it is visible.
 */
export interface QuerySpec {
  entity: string;
  select: string[];
  filters: QueryFilter[];
  group_by: string[];
  aggregates: QueryAggregate[];
  order_by: string | null;
  order_desc: boolean;
  limit: number;
}

export interface AiQueryResult {
  spec: QuerySpec | null;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  /** Set when the question could not be answered from the catalogue. */
  refusal: string | null;
}

export interface QueryEntity {
  name: string;
  description: string;
  fields: string[];
}

export async function askAiQuery(
  question: string,
  timezone?: string,
): Promise<AiQueryResult> {
  return apiFetch<AiQueryResult>("/ai/query", {
    method: "POST",
    body: JSON.stringify({ question, timezone: timezone ?? null }),
    headers: { "Content-Type": "application/json" },
  });
}

export async function getQueryEntities(): Promise<QueryEntity[]> {
  const data = await apiFetch<{ entities: QueryEntity[] }>(
    "/ai/query/entities",
  );
  return data.entities;
}

// ── Delay Alerts ─────────────────────────────────────────────────────

/** Low / medium / high, as the delay service bands it. Deliberately
 *  its own type rather than shared with any other risk scale — the
 *  services define them separately, and a shared alias would imply the
 *  two mean the same thing and move together. They do not. */
export type DelayRiskBand = "low" | "medium" | "high";

export interface DelayContributingFactor {
  factor: string;
  detail: string;
}

/**
 * What the model contributes — a band, never a score.
 *
 * The service's own schema explains the refusal: legacy asks for a
 * `delay_risk_score` of 0-100 from a handful of aggregate counts, and
 * there is no calculation that lands on 73 rather than 68. A two-digit
 * number sitting beside figures that were actually measured borrows
 * their authority. So there is nothing here to render as a percentage,
 * and nothing should be invented to fill the gap.
 */
export interface DelayJudgement {
  risk_band: DelayRiskBand;
  contributing_factors: DelayContributingFactor[];
  historical_context: string;
  recommendation: string;
}

/** Measured from flight history. These are the operator's own numbers,
 *  not the model's. */
export interface DelayRouteStats {
  origin: string;
  destination: string;
  flights: number;
  completed: number;
  cancelled: number;
  late: number;
  /** Null when there were too few prior flights for a percentage to
   *  mean anything. Rendering a null as "0%" would turn "we do not
   *  know" into "it never happens". */
  cancellation_rate: number | null;
  late_rate: number | null;
  enough_history: boolean;
}

export interface DelayAircraftStats {
  tail: string | null;
  flights: number;
  late: number;
  open_squawks: number;
  grounding_squawks: number;
  open_mels: number;
  is_grounded: boolean;
}

export interface DelayAssessment {
  flight_id: string;
  flight_number: string;
  route: DelayRouteStats;
  aircraft: DelayAircraftStats;
  window_days: number;
  /** Absent when the model could not be reached or would not answer.
   *  That does not invalidate the measured figures above it. */
  judgement: DelayJudgement | null;
  note: string | null;
  /** Carried in the payload rather than written into the page, so a
   *  client cannot render the assessment without it. */
  advisory: string;
}

/**
 * Assess one flight. POST because it spends a model call.
 *
 * Per flight rather than per day on purpose: the assessment reads that
 * flight's route history and that tail's squawk and MEL state, so
 * there is no batch form of it that would mean the same thing.
 */
export async function assessDelayRisk(
  flightId: string,
  timezone?: string,
): Promise<DelayAssessment> {
  return apiFetch<DelayAssessment>("/ai/delay-risk", {
    method: "POST",
    body: JSON.stringify({ flight_id: flightId, timezone: timezone ?? null }),
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
}
