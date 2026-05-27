/**
 * Typed wrappers around ops-service endpoints.
 */

import { apiFetch } from "./client";
import type {
  FlightDetail,
  FlightListResponse,
  FlightStatus,
  ReleaseResponse,
} from "./types";

export interface ListFlightsParams {
  onDate?: string; // YYYY-MM-DD (UTC)
  status?: FlightStatus;
  limit?: number;
  offset?: number;
}

export async function listFlights(
  params: ListFlightsParams = {},
): Promise<FlightListResponse> {
  const search = new URLSearchParams();
  if (params.onDate) search.set("on_date", params.onDate);
  if (params.status) search.set("status", params.status);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));

  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<FlightListResponse>(`/ops/flights${qs}`);
}

export async function getFlight(flightId: string): Promise<FlightDetail> {
  return apiFetch<FlightDetail>(`/ops/flights/${flightId}`);
}

export async function releaseFlight(flightId: string): Promise<ReleaseResponse> {
  return apiFetch<ReleaseResponse>(`/ops/flights/${flightId}/release`, {
    method: "POST",
  });
}
