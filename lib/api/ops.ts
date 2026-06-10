/**
 * Typed wrappers around ops-service endpoints.
 */

import { apiFetch } from "./client";
import type {
  AircraftListResponse,
  FlightDetail,
  FlightListResponse,
  FlightLogCreateRequest,
  FlightLogListResponse,
  FlightLogResponse,
  FlightLogStatus,
  FlightStats,
  FlightStatus,
  ReleaseResponse,
} from "./types";

export interface ListFlightsParams {
  onDate?: string; // YYYY-MM-DD (UTC)
  /** Single or multiple statuses. Multi-value lands as repeated
   *  `?status=` params, which FastAPI delivers as a list (M2-M-15). */
  status?: FlightStatus | FlightStatus[];
  limit?: number;
  offset?: number;
}

export async function listFlights(
  params: ListFlightsParams = {},
): Promise<FlightListResponse> {
  const search = new URLSearchParams();
  if (params.onDate) search.set("on_date", params.onDate);
  if (params.status) {
    const values = Array.isArray(params.status) ? params.status : [params.status];
    for (const s of values) search.append("status", s);
  }
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));

  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<FlightListResponse>(`/ops/flights${qs}`);
}

export interface FlightCreatePayload {
  flight_number: string;
  aircraft_id: string;
  origin: string;
  destination: string;
  scheduled_departure_at: string;  // ISO 8601 UTC
  scheduled_arrival_at: string;
  pax_count?: number;
  cargo_lbs?: number;
  notes?: string | null;
}

export async function createFlight(
  payload: FlightCreatePayload,
): Promise<FlightDetail> {
  return apiFetch<FlightDetail>("/ops/flights", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getFlight(flightId: string): Promise<FlightDetail> {
  return apiFetch<FlightDetail>(`/ops/flights/${flightId}`);
}

export async function releaseFlight(flightId: string): Promise<ReleaseResponse> {
  return apiFetch<ReleaseResponse>(`/ops/flights/${flightId}/release`, {
    method: "POST",
  });
}

/** Transition a flight from `scheduled` → `cancelled` (M2-M-18).
 *  Used by the M2-G-25 EOD page's bulk "Cancel stale flights" action. */
export async function cancelFlight(flightId: string): Promise<FlightDetail> {
  return apiFetch<FlightDetail>(`/ops/flights/${flightId}/cancel`, {
    method: "POST",
  });
}

export interface CheckInPayload {
  event: "depart" | "arrive";
  /** Optional override; defaults to server-side now() on the backend. */
  at?: string | null;
}

/** Record actual departure or arrival on a released flight (M2-M-19).
 *  Arrival also flips the status to `completed` server-side. */
export async function checkInFlight(
  flightId: string,
  payload: CheckInPayload,
): Promise<FlightDetail> {
  return apiFetch<FlightDetail>(`/ops/flights/${flightId}/check-in`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface FlightUpdatePayload {
  flight_number?: string;
  aircraft_id?: string;
  origin?: string;
  destination?: string;
  scheduled_departure_at?: string; // ISO 8601 UTC
  scheduled_arrival_at?: string;
  pax_count?: number;
  cargo_lbs?: number;
  notes?: string | null;
}

export async function updateFlight(
  flightId: string,
  patch: FlightUpdatePayload,
): Promise<FlightDetail> {
  return apiFetch<FlightDetail>(`/ops/flights/${flightId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function getFlightStats(): Promise<FlightStats> {
  return apiFetch<FlightStats>("/ops/flights/stats");
}

export async function listAircraft(): Promise<AircraftListResponse> {
  return apiFetch<AircraftListResponse>("/ops/aircraft");
}

// ---- Electronic Flight Log (M2-M-21 / M2-G-26b) ----------------------------

export interface ListFlightLogsParams {
  status?: FlightLogStatus | FlightLogStatus[];
  aircraftId?: string;
  limit?: number;
}

/** Fetch flight logs, optionally filtered by status (single or multi)
 *  and aircraft. Powers the M2-G-26b Active Drafts panel + the M3
 *  per-tail history view. */
export async function listFlightLogs(
  params: ListFlightLogsParams = {},
): Promise<FlightLogListResponse> {
  const search = new URLSearchParams();
  if (params.status) {
    const values = Array.isArray(params.status) ? params.status : [params.status];
    for (const s of values) search.append("status", s);
  }
  if (params.aircraftId) search.set("aircraft_id", params.aircraftId);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<FlightLogListResponse>(`/ops/flight-logs${qs}`);
}

/** Create a new draft flight log. Backs the "Start Flight Log"
 *  submit action on the elog landing. */
export async function createFlightLog(
  payload: FlightLogCreateRequest,
): Promise<FlightLogResponse> {
  return apiFetch<FlightLogResponse>("/ops/flight-logs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
