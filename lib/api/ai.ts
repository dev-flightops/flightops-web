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
