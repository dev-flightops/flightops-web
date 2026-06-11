/**
 * Typed wrappers around ground-service endpoints (M2-M-25a).
 *
 * Stations + station-issues today; GSE, fuel, load teams, check-in
 * config land as subsequent ground-service stories.
 */

import { apiFetch } from "./client";
import type {
  StationIssueListResponse,
  StationIssueStatus,
  StationListResponse,
} from "./types";

export interface ListStationsParams {
  /** ICAO prefix filter — server-side case-insensitive prefix match. */
  icaoPrefix?: string;
  limit?: number;
}

/** List stations alphabetically by ICAO with per-station open-issue
 *  counts aggregated server-side. Powers /stations. */
export async function listStations(
  params: ListStationsParams = {},
): Promise<StationListResponse> {
  const search = new URLSearchParams();
  if (params.icaoPrefix) search.set("icao_prefix", params.icaoPrefix);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<StationListResponse>(`/ground/stations${qs}`);
}

export interface ListStationIssuesParams {
  status?: StationIssueStatus;
  limit?: number;
}

/** List issues for a single station, newest-first. */
export async function listStationIssues(
  stationId: string,
  params: ListStationIssuesParams = {},
): Promise<StationIssueListResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<StationIssueListResponse>(
    `/ground/stations/${stationId}/issues${qs}`,
  );
}

/** Cross-station open-issues feed for the Ground Ops hub. Backend
 *  defaults to status=open; pass status='in_progress' / 'resolved' to
 *  override or null to list across all states. */
export async function listOpenStationIssues(
  params: ListStationIssuesParams = {},
): Promise<StationIssueListResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<StationIssueListResponse>(`/ground/station-issues${qs}`);
}
