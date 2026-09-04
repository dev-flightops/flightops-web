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
