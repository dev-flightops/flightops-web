/**
 * Typed wrappers around ground-service endpoints (M2-M-25a).
 *
 * Stations + station-issues today; GSE, fuel, load teams, check-in
 * config land as subsequent ground-service stories.
 */

import { apiFetch } from "./client";
import type {
  GSEEquipmentType,
  GSEMaintenanceListResponse,
  GSESquawkListResponse,
  GSESquawkStatus,
  GSEUnitListItem,
  GSEUnitListResponse,
  GSEUnitStatus,
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

// GSE (M2-M-25b / M2-G-39) ----------------------------------------------------

export interface ListGseUnitsParams {
  status?: GSEUnitStatus;
  equipmentType?: GSEEquipmentType;
  stationId?: string;
  limit?: number;
}

/** List GSE units alphabetically by name, with open-squawk counts
 *  aggregated server-side. */
export async function listGseUnits(
  params: ListGseUnitsParams = {},
): Promise<GSEUnitListResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.equipmentType)
    search.set("equipment_type", params.equipmentType);
  if (params.stationId) search.set("station_id", params.stationId);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<GSEUnitListResponse>(`/ground/gse${qs}`);
}

/** Fetch one GSE unit — backend returns the same shape as a list item. */
export async function getGseUnit(unitId: string): Promise<GSEUnitListItem> {
  return apiFetch<GSEUnitListItem>(`/ground/gse/${unitId}`);
}

/** List maintenance items for a unit, ordered by due_date asc. */
export async function listGseMaintenance(
  unitId: string,
  params: { limit?: number } = {},
): Promise<GSEMaintenanceListResponse> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<GSEMaintenanceListResponse>(
    `/ground/gse/${unitId}/maintenance${qs}`,
  );
}

/** List squawks for a unit, newest-first; optional status filter. */
export async function listGseSquawks(
  unitId: string,
  params: { status?: GSESquawkStatus; limit?: number } = {},
): Promise<GSESquawkListResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<GSESquawkListResponse>(
    `/ground/gse/${unitId}/squawks${qs}`,
  );
}
