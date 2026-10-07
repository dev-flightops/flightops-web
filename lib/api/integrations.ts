/**
 * The company's ForeFlight connection (#54): ops' /integrations/foreflight.
 * The API key is write-only: nothing here, or anywhere, reads it back.
 *
 * The pilots' plans brought back (#55): ops' /integrations/flights/{id}/plans
 * and /integrations/plans/*.
 */

import { apiFetch } from "./client";
import type { UserRef } from "./types";

export type LinkState = "sent" | "failed" | "frozen" | "removed";

/** A leg the connection couldn't send cleanly. */
export interface ForeFlightProblem {
  flight_id: string;
  flight_number: string;
  leg_sequence: number;
  departs_at: string;
  state: LinkState;
  message: string;
}

export interface ForeFlightConnection {
  has_key: boolean;
  send_flights: boolean;
  bring_plans: boolean;
  last_fetch_at: string | null;
  /** Plans waiting in the review queue for a dispatcher to place. */
  plans_waiting: number;
  account_name: string | null;
  checked_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  /** How many legs are in each state. */
  legs: Partial<Record<LinkState, number>>;
  problems: ForeFlightProblem[];
  updated_by: UserRef | null;
  updated_at: string | null;
}

export interface ForeFlightCheck {
  error: string | null;
  account_name: string | null;
  aircraft: number;
  crew: number;
  tails_missing: string[];
  crew_missing: { name: string; email: string }[];
}

export interface ForeFlightSend {
  error: string | null;
  created: number;
  updated: number;
  unchanged: number;
  frozen: number;
  removed: number;
  failed: number;
  problems: string[];
}

export interface ForeFlightFetch {
  error: string | null;
  fetched: number;
  linked: number;
  matched: number;
  waiting: number;
  failed: number;
}

/** How a plan found its leg: we sent the leg (linked), its tail, airports
 *  and time fit one leg (matched), a dispatcher put it there (assigned);
 *  or it waits in the queue (unmatched, ambiguous) or was set aside. */
export type PlanMatch = "linked" | "matched" | "assigned" | "unmatched" | "ambiguous" | "ignored";

export interface PlanWeight {
  point: string;
  weight: number;
  max: number | null;
}

export interface PlanCg {
  point: string;
  cg: number;
  fwd: number | null;
  aft: number | null;
}

/** A plan as ops keeps it, whichever tool it came from. */
export interface ToolPlan {
  source: string;
  tail: string | null;
  departure: string;
  destination: string;
  alternates: string[];
  route: string | null;
  flight_rule: string | null;
  departs_at: string | null;
  arrives_at: string | null;
  ete_minutes: number | null;
  fuel: {
    unit: string | null;
    total: number | null;
    to_destination: number | null;
    reserve: number | null;
    alternate: number | null;
    landing: number | null;
  };
  weight_unit: string;
  weights: PlanWeight[];
  cg_unit: string;
  cg: PlanCg[];
  /** True inside every limit the tool gave, false outside one, null when
   *  the tool has no weight and balance for it yet. */
  within_limits: boolean | null;
  limit_issues: string[];
  released: boolean;
  filing_status: string | null;
  crew: { position: string | null; id: string | null }[];
  warnings: string[];
}

export interface ExternalPlan {
  id: string;
  provider: string;
  leg_sequence: number | null;
  match: PlanMatch;
  plan: ToolPlan;
  fetched_at: string;
}

export interface FlightPlans {
  flight_id: string;
  /** Peregrine's own check, which stays the record. */
  our_weight_and_balance: "within" | "over" | null;
  plans: ExternalPlan[];
  /** Plans whose weight and balance says the opposite of ours. */
  disagreements: string[];
  /** The company brings plans back, so "no plan yet" means something. */
  bringing_plans: boolean;
}

export interface PlanCandidate {
  flight_id: string;
  flight_number: string;
  leg_sequence: number;
  origin: string;
  destination: string;
  departs_at: string;
}

export interface QueuedPlan extends ExternalPlan {
  candidates: PlanCandidate[];
}

export type PlanDocument = "navlog" | "briefing" | "wb";

const BASE = "/ops/integrations/foreflight";
const PLANS = "/ops/integrations";

export async function getForeFlight(): Promise<ForeFlightConnection> {
  return apiFetch<ForeFlightConnection>(BASE);
}

export async function updateForeFlight(body: {
  api_key?: string;
  send_flights?: boolean;
  bring_plans?: boolean;
}): Promise<ForeFlightConnection> {
  return apiFetch<ForeFlightConnection>(BASE, { method: "PUT", body: JSON.stringify(body) });
}

export async function disconnectForeFlight(): Promise<ForeFlightConnection> {
  return apiFetch<ForeFlightConnection>(`${BASE}/key`, { method: "DELETE" });
}

export async function checkForeFlight(): Promise<ForeFlightCheck> {
  return apiFetch<ForeFlightCheck>(`${BASE}/test`, { method: "POST" });
}

export async function sendToForeFlight(): Promise<ForeFlightSend> {
  return apiFetch<ForeFlightSend>(`${BASE}/send`, { method: "POST" });
}

export async function fetchFromForeFlight(): Promise<ForeFlightFetch> {
  return apiFetch<ForeFlightFetch>(`${BASE}/fetch`, { method: "POST" });
}

export async function getFlightPlans(flightId: string): Promise<FlightPlans> {
  return apiFetch<FlightPlans>(`${PLANS}/flights/${encodeURIComponent(flightId)}/plans`);
}

export async function getPlanQueue(): Promise<QueuedPlan[]> {
  return apiFetch<QueuedPlan[]>(`${PLANS}/plans/queue`);
}

/** The queue's length alone, for the dispatch page's banner. */
export async function getPlansWaiting(): Promise<{ waiting: number }> {
  return apiFetch<{ waiting: number }>(`${PLANS}/plans/waiting`);
}

export async function assignPlan(
  planId: string,
  flightId: string,
  legSequence: number,
): Promise<ExternalPlan> {
  return apiFetch<ExternalPlan>(`${PLANS}/plans/${encodeURIComponent(planId)}/assign`, {
    method: "POST",
    body: JSON.stringify({ flight_id: flightId, leg_sequence: legSequence }),
  });
}

export async function ignorePlan(planId: string): Promise<ExternalPlan> {
  return apiFetch<ExternalPlan>(`${PLANS}/plans/${encodeURIComponent(planId)}/ignore`, {
    method: "POST",
  });
}

/** A fresh link to the plan's document in the tool; the tool's links expire. */
export async function getPlanDocument(planId: string, kind: PlanDocument): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(
    `${PLANS}/plans/${encodeURIComponent(planId)}/documents/${kind}`,
  );
}
