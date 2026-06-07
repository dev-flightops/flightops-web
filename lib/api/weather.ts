/**
 * Typed wrappers around weather-service endpoints (M2-M-3).
 *
 * Both endpoints share the cache-or-fetch contract — backend returns
 * `cache_hit: true` when the row came from the `weather_reports` cache,
 * `false` when AWC was hit on this request. The UI uses that to render
 * a small "live" vs "cached Xm ago" badge.
 */

import { apiFetch } from "./client";
import type { WeatherReportResponse } from "./types";

export async function getMetar(icao: string): Promise<WeatherReportResponse> {
  return apiFetch<WeatherReportResponse>(`/weather/metar/${icao}`);
}

export async function getTaf(icao: string): Promise<WeatherReportResponse> {
  return apiFetch<WeatherReportResponse>(`/weather/taf/${icao}`);
}
