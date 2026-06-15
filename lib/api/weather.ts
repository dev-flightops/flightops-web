/**
 * Typed wrappers around weather-service endpoints (M2-M-3).
 *
 * Both endpoints share the cache-or-fetch contract — backend returns
 * `cache_hit: true` when the row came from the `weather_reports` cache,
 * `false` when AWC was hit on this request. The UI uses that to render
 * a small "live" vs "cached Xm ago" badge.
 */

import { apiFetch } from "./client";
import type {
  VillageAirportCreateRequest,
  VillageAirportListResponse,
  VillageAirportResponse,
  VillageBoardResponse,
  VillageWeatherReportCreateRequest,
  VillageWeatherReportListResponse,
  VillageWeatherReportResponse,
  WeatherBatchRequestItem,
  WeatherBatchResponse,
  WeatherBriefingCreateRequest,
  WeatherBriefingListResponse,
  WeatherBriefingResponse,
  WeatherReportResponse,
} from "./types";

export async function getMetar(icao: string): Promise<WeatherReportResponse> {
  return apiFetch<WeatherReportResponse>(`/weather/metar/${icao}`);
}

export async function getTaf(icao: string): Promise<WeatherReportResponse> {
  return apiFetch<WeatherReportResponse>(`/weather/taf/${icao}`);
}

/**
 * Fetch many (icao, kind) reports in one round-trip (M2-M-12). Per-item
 * failures are isolated into the response's errors[] — the call itself
 * resolves successfully as long as the request shape is valid.
 *
 * Backend caps at 20 requests per batch. UI should slice longer routes
 * before sending.
 */
export async function batchWeather(
  requests: WeatherBatchRequestItem[],
): Promise<WeatherBatchResponse> {
  return apiFetch<WeatherBatchResponse>(`/weather/batch`, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
}

// ---- Saved briefings (M2-M-22 / M2-G-27) ------------------------------------

export interface ListWeatherBriefingsParams {
  flightId?: string;
  aircraftId?: string;
  limit?: number;
}

/** List saved weather briefings, newest-first. Powers the M2-G-27
 *  /weather landing. */
export async function listWeatherBriefings(
  params: ListWeatherBriefingsParams = {},
): Promise<WeatherBriefingListResponse> {
  const search = new URLSearchParams();
  if (params.flightId) search.set("flight_id", params.flightId);
  if (params.aircraftId) search.set("aircraft_id", params.aircraftId);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<WeatherBriefingListResponse>(`/weather/briefings${qs}`);
}

/** Fetch a single saved briefing including its frozen snapshot.
 *  Used by /weather/{id} for the permalink-able detail view. */
export async function getWeatherBriefing(
  briefingId: string,
): Promise<WeatherBriefingResponse> {
  return apiFetch<WeatherBriefingResponse>(
    `/weather/briefings/${briefingId}`,
  );
}

/** Create a new briefing — backend fetches METAR/TAF for each airport,
 *  snapshots them, and persists. Returns the saved briefing with the
 *  snapshot inline so the redirect target page can render without
 *  re-fetching. */
export async function createWeatherBriefing(
  payload: WeatherBriefingCreateRequest,
): Promise<WeatherBriefingResponse> {
  return apiFetch<WeatherBriefingResponse>(`/weather/briefings`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---- Village weather (M2-M-29) ----------------------------------------------

export async function getVillageBoard(): Promise<VillageBoardResponse> {
  return apiFetch<VillageBoardResponse>(`/weather/village-board`);
}

export async function listVillageAirports(
  options: { includeInactive?: boolean } = {},
): Promise<VillageAirportListResponse> {
  const qs = options.includeInactive ? "?include_inactive=true" : "";
  return apiFetch<VillageAirportListResponse>(
    `/weather/village-airports${qs}`,
  );
}

export async function createVillageAirport(
  body: VillageAirportCreateRequest,
): Promise<VillageAirportResponse> {
  return apiFetch<VillageAirportResponse>(`/weather/village-airports`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listVillageReportsForAirport(
  airportId: string,
  limit = 20,
): Promise<VillageWeatherReportListResponse> {
  return apiFetch<VillageWeatherReportListResponse>(
    `/weather/village-airports/${airportId}/reports?limit=${limit}`,
  );
}

export async function createVillageWeatherReport(
  body: VillageWeatherReportCreateRequest,
): Promise<VillageWeatherReportResponse> {
  return apiFetch<VillageWeatherReportResponse>(`/weather/village-reports`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
