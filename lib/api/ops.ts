/**
 * Typed wrappers around ops-service endpoints.
 */

import { apiFetch } from "./client";
import type {
  AircraftListResponse,
  FlightDetail,
  FlightListResponse,
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
