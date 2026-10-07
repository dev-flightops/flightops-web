/**
 * The company's ForeFlight connection (#54): ops' /integrations/foreflight.
 * The API key is write-only: nothing here, or anywhere, reads it back.
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

const BASE = "/ops/integrations/foreflight";

export async function getForeFlight(): Promise<ForeFlightConnection> {
  return apiFetch<ForeFlightConnection>(BASE);
}

export async function updateForeFlight(body: {
  api_key?: string;
  send_flights?: boolean;
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
