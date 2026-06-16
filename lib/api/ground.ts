/**
 * Typed wrappers around ground-service endpoints (M2-M-25a).
 *
 * Stations + station-issues today; GSE, fuel, load teams, check-in
 * config land as subsequent ground-service stories.
 */

import { apiFetch } from "./client";
import type {
  FuelOrderCloseSource,
  FuelOrderListResponse,
  FuelOrderResponse,
  FuelOrderStatus,
  FuelOrderStatusLogResponse,
  FuelQualityResult,
  FuelQualityTestCreateRequest,
  FuelQualityTestKind,
  FuelQualityTestListResponse,
  FuelQualityTestResponse,
  FuelSupplierBaseListResponse,
  FuelSupplierListResponse,
  FuelTypeListResponse,
  GSEEquipmentType,
  GSEMaintenanceItemResponse,
  GSEMaintenanceListResponse,
  GSEMxItemType,
  GSESquawkListResponse,
  GSESquawkResponse,
  GSESquawkStatus,
  GSEUnitListItem,
  GSEUnitListResponse,
  GSEUnitStatus,
  FlightAssignmentCreateRequest,
  FlightAssignmentListResponse,
  FlightAssignmentResponse,
  LoadTeamListResponse,
  StationIssueCategory,
  StationIssueListResponse,
  StationIssuePriority,
  StationIssueResponse,
  StationIssueStatus,
  StationListItem,
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

// Fuel directory + pricing matrix (M2-M-25c) ---------------------------------

/** List fuel types configured for this tenant. Active-only by default. */
export async function listFuelTypes(
  params: { includeInactive?: boolean } = {},
): Promise<FuelTypeListResponse> {
  const search = new URLSearchParams();
  if (params.includeInactive) search.set("include_inactive", "true");
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<FuelTypeListResponse>(`/ground/fuel/types${qs}`);
}

/** List fuel suppliers. Active-only by default. */
export async function listFuelSuppliers(
  params: { includeInactive?: boolean } = {},
): Promise<FuelSupplierListResponse> {
  const search = new URLSearchParams();
  if (params.includeInactive) search.set("include_inactive", "true");
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<FuelSupplierListResponse>(`/ground/fuel/suppliers${qs}`);
}

export interface ListSupplierBasesParams {
  supplierId?: string;
  baseCode?: string;
  fuelTypeId?: string;
  includeInactive?: boolean;
}

/** Pricing matrix rows for the supplier × base × fuel_type intersection. */
export async function listSupplierBases(
  params: ListSupplierBasesParams = {},
): Promise<FuelSupplierBaseListResponse> {
  const search = new URLSearchParams();
  if (params.supplierId) search.set("supplier_id", params.supplierId);
  if (params.baseCode) search.set("base_code", params.baseCode);
  if (params.fuelTypeId) search.set("fuel_type_id", params.fuelTypeId);
  if (params.includeInactive) search.set("include_inactive", "true");
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<FuelSupplierBaseListResponse>(
    `/ground/fuel/supplier-bases${qs}`,
  );
}

// Stations CRUD (M2-G-38b) ---------------------------------------------------

export interface CreateStationPayload {
  icao_code: string;
  name: string;
  city?: string | null;
  state?: string | null;
  elevation_ft?: number | null;
  has_reporting_function?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
}

export async function createStation(
  payload: CreateStationPayload,
): Promise<StationListItem> {
  return apiFetch<StationListItem>("/ground/stations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface CreateStationIssuePayload {
  title: string;
  description: string;
  category?: StationIssueCategory;
  priority?: StationIssuePriority;
  assigned_to?: string | null;
}

export async function createStationIssue(
  stationId: string,
  payload: CreateStationIssuePayload,
): Promise<StationIssueResponse> {
  return apiFetch<StationIssueResponse>(
    `/ground/stations/${stationId}/issues`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function resolveStationIssue(
  issueId: string,
  resolutionNotes: string,
): Promise<StationIssueResponse> {
  return apiFetch<StationIssueResponse>(
    `/ground/station-issues/${issueId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({ resolution_notes: resolutionNotes }),
    },
  );
}

// GSE CRUD (M2-G-39b) --------------------------------------------------------

export interface CreateGseUnitPayload {
  name: string;
  equipment_type: GSEEquipmentType;
  make?: string | null;
  model?: string | null;
  serial_number?: string | null;
  year?: number | null;
  station_id?: string | null;
  service_interval_days?: number | null;
  hours_total?: number;
  manufacturer?: string | null;
  notes?: string | null;
}

export async function createGseUnit(
  payload: CreateGseUnitPayload,
): Promise<GSEUnitListItem> {
  return apiFetch<GSEUnitListItem>("/ground/gse", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function changeGseStatus(
  unitId: string,
  status: GSEUnitStatus,
  statusNote: string | null,
): Promise<GSEUnitListItem> {
  return apiFetch<GSEUnitListItem>(`/ground/gse/${unitId}/status`, {
    method: "POST",
    body: JSON.stringify({ status, status_note: statusNote }),
  });
}

export interface CreateGseMaintenancePayload {
  title: string;
  description?: string | null;
  item_type?: GSEMxItemType;
  interval_days?: number | null;
  interval_hours?: number | null;
  due_date?: string | null;
  due_hours?: number | null;
  is_recurring?: boolean;
}

export async function createGseMaintenance(
  unitId: string,
  payload: CreateGseMaintenancePayload,
): Promise<GSEMaintenanceItemResponse> {
  return apiFetch<GSEMaintenanceItemResponse>(
    `/ground/gse/${unitId}/maintenance`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function completeGseMaintenance(
  unitId: string,
  mxId: string,
  payload: { completed_date: string; completed_hours?: number | null },
): Promise<GSEMaintenanceItemResponse> {
  return apiFetch<GSEMaintenanceItemResponse>(
    `/ground/gse/${unitId}/maintenance/${mxId}/complete`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function createGseSquawk(
  unitId: string,
  description: string,
  reportedDate: string,
): Promise<GSESquawkResponse> {
  return apiFetch<GSESquawkResponse>(`/ground/gse/${unitId}/squawks`, {
    method: "POST",
    body: JSON.stringify({
      description,
      reported_date: reportedDate,
    }),
  });
}

export async function resolveGseSquawk(
  squawkId: string,
  resolutionNotes: string,
): Promise<GSESquawkResponse> {
  return apiFetch<GSESquawkResponse>(
    `/ground/gse/squawks/${squawkId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({ resolution_notes: resolutionNotes }),
    },
  );
}

// Fuel orders (M2-M-27b / M2-G-40) -------------------------------------------

export interface ListFuelOrdersParams {
  status?: FuelOrderStatus;
  baseCode?: string;
  nNumber?: string;
  limit?: number;
}

export async function listFuelOrders(
  params: ListFuelOrdersParams = {},
): Promise<FuelOrderListResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.baseCode) search.set("base_code", params.baseCode);
  if (params.nNumber) search.set("n_number", params.nNumber);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<FuelOrderListResponse>(`/ground/fuel/orders${qs}`);
}

export async function getFuelOrder(
  orderId: string,
): Promise<FuelOrderResponse> {
  return apiFetch<FuelOrderResponse>(`/ground/fuel/orders/${orderId}`);
}

export async function getFuelOrderStatusLog(
  orderId: string,
): Promise<FuelOrderStatusLogResponse> {
  return apiFetch<FuelOrderStatusLogResponse>(
    `/ground/fuel/orders/${orderId}/status-log`,
  );
}

export interface CreateFuelOrderPayload {
  n_number: string;
  base_code: string;
  supplier_id: string;
  fuel_type_id: string;
  requested_quantity_gallons: number;
  requested_fuel_date: string;
  requested_fuel_time?: string | null;
  special_instructions?: string | null;
}

export async function createFuelOrder(
  payload: CreateFuelOrderPayload,
): Promise<FuelOrderResponse> {
  return apiFetch<FuelOrderResponse>("/ground/fuel/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function confirmFuelOrder(
  orderId: string,
  confirmedByName: string,
  confirmedNote: string | null,
): Promise<FuelOrderResponse> {
  return apiFetch<FuelOrderResponse>(
    `/ground/fuel/orders/${orderId}/confirm`,
    {
      method: "POST",
      body: JSON.stringify({
        confirmed_by_name: confirmedByName,
        confirmed_note: confirmedNote,
      }),
    },
  );
}

export interface FuelOrderFueledPayload {
  fueled_by_name: string;
  actual_quantity_gallons: number;
  discrepancy_reason?: string | null;
  closed_by_source?: FuelOrderCloseSource;
  invoice_pending?: boolean;
}

export async function markFuelOrderFueled(
  orderId: string,
  payload: FuelOrderFueledPayload,
): Promise<FuelOrderResponse> {
  return apiFetch<FuelOrderResponse>(
    `/ground/fuel/orders/${orderId}/fueled`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function cancelFuelOrder(
  orderId: string,
  cancelReason: string,
  closedBySource: FuelOrderCloseSource = "dispatch",
): Promise<FuelOrderResponse> {
  return apiFetch<FuelOrderResponse>(
    `/ground/fuel/orders/${orderId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        cancel_reason: cancelReason,
        closed_by_source: closedBySource,
      }),
    },
  );
}

// Load Teams (M2-M-25d) -----------------------------------------------------

/** List load teams, alphabetically by team_name. Active-only filter
 *  is server-side; pass `includeInactive: true` to surface archived teams.
 *
 *  Flight-to-team assignment is M2-M-25e — until that lands, /ramp-ops
 *  uses the list read-only to render the team column. */
export async function listLoadTeams(
  options: { includeInactive?: boolean; baseIcao?: string } = {},
): Promise<LoadTeamListResponse> {
  const search = new URLSearchParams();
  if (options.includeInactive) search.set("include_inactive", "true");
  if (options.baseIcao) search.set("base_icao", options.baseIcao);
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<LoadTeamListResponse>(`/ground/load-teams${qs}`);
}

// Flight × LoadTeam assignments (M2-M-25e) ---------------------------------

/** List active assignments for a team — flights currently on that team.
 *  Used by /ramp-ops to render the flights-by-team list in the right
 *  column. */
export async function listAssignmentsByTeam(
  teamId: string,
): Promise<FlightAssignmentListResponse> {
  return apiFetch<FlightAssignmentListResponse>(
    `/ground/flight-assignments?team_id=${teamId}`,
  );
}

/** Idempotent upsert: assign a flight to a team. Re-posting the same
 *  (flight, team) returns the existing row; reposting with a different
 *  team closes the old assignment and creates a new one in one
 *  transaction. */
export async function assignFlightToTeam(
  body: FlightAssignmentCreateRequest,
): Promise<FlightAssignmentResponse> {
  return apiFetch<FlightAssignmentResponse>(`/ground/flight-assignments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Clear the active assignment for a flight. 404 from the server if
 *  nothing was assigned — callers should treat that as "already
 *  unassigned" rather than user-facing error. */
export async function unassignFlight(flightId: string): Promise<void> {
  await apiFetch<void>(
    `/ground/flight-assignments?flight_id=${flightId}`,
    { method: "DELETE" },
  );
}

// Fuel quality test log (M2-M-30) ------------------------------------------

export interface ListFuelQualityTestsParams {
  baseCode?: string;
  nNumber?: string;
  testKind?: FuelQualityTestKind;
  result?: FuelQualityResult;
  onlyFailures?: boolean;
  limit?: number;
}

export async function listFuelQualityTests(
  params: ListFuelQualityTestsParams = {},
): Promise<FuelQualityTestListResponse> {
  const search = new URLSearchParams();
  if (params.baseCode) search.set("base_code", params.baseCode);
  if (params.nNumber) search.set("n_number", params.nNumber);
  if (params.testKind) search.set("test_kind", params.testKind);
  if (params.result) search.set("result", params.result);
  if (params.onlyFailures) search.set("only_failures", "true");
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<FuelQualityTestListResponse>(
    `/ground/fuel/quality-tests${qs}`,
  );
}

export async function createFuelQualityTest(
  body: FuelQualityTestCreateRequest,
): Promise<FuelQualityTestResponse> {
  return apiFetch<FuelQualityTestResponse>(
    `/ground/fuel/quality-tests`,
    { method: "POST", body: JSON.stringify(body) },
  );
}
