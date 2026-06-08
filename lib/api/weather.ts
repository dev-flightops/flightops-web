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
  WeatherBatchRequestItem,
  WeatherBatchResponse,
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
