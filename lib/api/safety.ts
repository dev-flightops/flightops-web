/**
 * Typed wrappers around safety-service endpoints (M3 SMS foundation).
 *
 * Backend: services/safety/app/routes/hazards.py
 *   POST  /safety/hazards        submit (any authenticated user)
 *   GET   /safety/hazards        triage inbox (Safety Officer, Chief Pilot, Exec Admin)
 *   GET   /safety/hazards/mine   reporter's own submissions
 *   GET   /safety/hazards/{id}   detail (triage roles)
 *   PATCH /safety/hazards/{id}   status + close (triage roles)
 */

import { apiFetch } from "./client";

export type HazardCategory =
  | "flight_ops"
  | "ground_ops"
  | "maintenance"
  | "environment"
  | "security"
  | "human_factors"
  | "other";

export type HazardSeverity = "low" | "medium" | "high" | "critical";

export type HazardStatus =
  | "submitted"
  | "triaged"
  | "in_progress"
  | "closed";

export const HAZARD_CATEGORIES: readonly HazardCategory[] = [
  "flight_ops",
  "ground_ops",
  "maintenance",
  "environment",
  "security",
  "human_factors",
  "other",
] as const;

export const HAZARD_SEVERITIES: readonly HazardSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const HAZARD_STATUSES: readonly HazardStatus[] = [
  "submitted",
  "triaged",
  "in_progress",
  "closed",
] as const;

// Human-readable copy for the UI. Keys match the backend enum values so
// tests can assert against them directly.
export const HAZARD_CATEGORY_LABELS: Record<HazardCategory, string> = {
  flight_ops: "Flight Ops",
  ground_ops: "Ground Ops",
  maintenance: "Maintenance",
  environment: "Environment",
  security: "Security",
  human_factors: "Human Factors",
  other: "Other",
};

export const HAZARD_SEVERITY_LABELS: Record<HazardSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const HAZARD_STATUS_LABELS: Record<HazardStatus, string> = {
  submitted: "Submitted",
  triaged: "Triaged",
  in_progress: "In Progress",
  closed: "Closed",
};

export interface UserRef {
  id: string;
  full_name: string;
  email: string;
}

export interface StationRef {
  id: string;
  icao_code: string;
  name: string;
}

export interface HazardReport {
  id: string;
  category: HazardCategory;
  severity: HazardSeverity;
  status: HazardStatus;
  description: string;
  immediate_action_taken: string | null;
  location_free_text: string | null;
  station: StationRef | null;
  is_anonymous: boolean;
  reporter: UserRef | null;
  triaged_at: string | null;
  triaged_by: UserRef | null;
  closed_at: string | null;
  closed_by: UserRef | null;
  closed_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface HazardListResponse {
  items: HazardReport[];
  total: number;
}

export interface ListHazardsParams {
  status?: HazardStatus;
  category?: HazardCategory;
  severity?: HazardSeverity;
  limit?: number;
  offset?: number;
}

function _qs(params: ListHazardsParams): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.category) search.set("category", params.category);
  if (params.severity) search.set("severity", params.severity);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  const s = search.toString();
  return s ? `?${s}` : "";
}

export async function listHazards(
  params: ListHazardsParams = {},
): Promise<HazardListResponse> {
  return apiFetch<HazardListResponse>(`/safety/hazards${_qs(params)}`);
}

export async function listMyHazards(
  params: Pick<ListHazardsParams, "limit" | "offset"> = {},
): Promise<HazardListResponse> {
  return apiFetch<HazardListResponse>(`/safety/hazards/mine${_qs(params)}`);
}

export async function getHazard(hazardId: string): Promise<HazardReport> {
  return apiFetch<HazardReport>(`/safety/hazards/${hazardId}`);
}

export interface SubmitHazardInput {
  category: HazardCategory;
  severity: HazardSeverity;
  description: string;
  station_id?: string | null;
  location_free_text?: string | null;
  immediate_action_taken?: string | null;
  is_anonymous?: boolean;
}

export async function submitHazard(
  input: SubmitHazardInput,
): Promise<HazardReport> {
  return apiFetch<HazardReport>("/safety/hazards", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface PatchHazardInput {
  status?: HazardStatus;
  closed_reason?: string | null;
}

export async function patchHazard(
  hazardId: string,
  input: PatchHazardInput,
): Promise<HazardReport> {
  return apiFetch<HazardReport>(`/safety/hazards/${hazardId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

// ============================================================================
// Incidents
// ============================================================================

export type IncidentCategory =
  | "flight_ops"
  | "ground_ops"
  | "maintenance"
  | "environment"
  | "security"
  | "human_factors"
  | "wildlife"
  | "other";

export type IncidentSeverity = HazardSeverity;
export type IncidentStatus = HazardStatus;

export const INCIDENT_CATEGORIES: readonly IncidentCategory[] = [
  "flight_ops",
  "ground_ops",
  "maintenance",
  "environment",
  "security",
  "human_factors",
  "wildlife",
  "other",
] as const;

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  flight_ops: "Flight Ops",
  ground_ops: "Ground Ops",
  maintenance: "Maintenance",
  environment: "Environment",
  security: "Security",
  human_factors: "Human Factors",
  wildlife: "Wildlife",
  other: "Other",
};

export interface AircraftRef {
  id: string;
  tail_number: string;
  model: string | null;
}

export interface FlightRef {
  id: string;
  flight_number: string | null;
}

export interface Incident {
  id: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  occurred_at: string;
  description: string;
  injury_summary: string;
  damage_summary: string;
  immediate_action_taken: string | null;
  aircraft: AircraftRef | null;
  flight: FlightRef | null;
  station: StationRef | null;
  location_free_text: string | null;
  is_anonymous: boolean;
  reporter: UserRef | null;
  triaged_at: string | null;
  triaged_by: UserRef | null;
  closed_at: string | null;
  closed_by: UserRef | null;
  closed_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentListResponse {
  items: Incident[];
  total: number;
}

export interface ListIncidentsParams {
  status?: IncidentStatus;
  category?: IncidentCategory;
  severity?: IncidentSeverity;
  limit?: number;
  offset?: number;
}

function _incidentsQs(params: ListIncidentsParams): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.category) search.set("category", params.category);
  if (params.severity) search.set("severity", params.severity);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  const s = search.toString();
  return s ? `?${s}` : "";
}

export async function listIncidents(
  params: ListIncidentsParams = {},
): Promise<IncidentListResponse> {
  return apiFetch<IncidentListResponse>(
    `/safety/incidents${_incidentsQs(params)}`,
  );
}

export async function listMyIncidents(
  params: Pick<ListIncidentsParams, "limit" | "offset"> = {},
): Promise<IncidentListResponse> {
  return apiFetch<IncidentListResponse>(
    `/safety/incidents/mine${_incidentsQs(params)}`,
  );
}

export async function getIncident(incidentId: string): Promise<Incident> {
  return apiFetch<Incident>(`/safety/incidents/${incidentId}`);
}

export interface SubmitIncidentInput {
  category: IncidentCategory;
  severity: IncidentSeverity;
  occurred_at: string; // ISO 8601
  description: string;
  injury_summary?: string;
  damage_summary?: string;
  aircraft_id?: string | null;
  flight_id?: string | null;
  station_id?: string | null;
  location_free_text?: string | null;
  immediate_action_taken?: string | null;
  is_anonymous?: boolean;
}

export async function submitIncident(
  input: SubmitIncidentInput,
): Promise<Incident> {
  return apiFetch<Incident>("/safety/incidents", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface PatchIncidentInput {
  status?: IncidentStatus;
  closed_reason?: string | null;
}

export async function patchIncident(
  incidentId: string,
  input: PatchIncidentInput,
): Promise<Incident> {
  return apiFetch<Incident>(`/safety/incidents/${incidentId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

// ============================================================================
// Corrective Actions (CAPAs)
// ============================================================================

export type CapaSourceType = "hazard" | "incident";
export type CapaStatus = "open" | "in_progress" | "closed";

export const CAPA_STATUS_LABELS: Record<CapaStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  closed: "Closed",
};

export interface CorrectiveAction {
  id: string;
  source_type: CapaSourceType;
  source_id: string;
  title: string;
  description: string;
  owner: UserRef;
  due_date: string; // YYYY-MM-DD
  status: CapaStatus;
  notes: string;
  opened_by: UserRef;
  closed_at: string | null;
  closed_by: UserRef | null;
  closed_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CorrectiveActionListResponse {
  items: CorrectiveAction[];
  total: number;
}

export interface ListCapasParams {
  status?: CapaStatus;
  owner_user_id?: string;
  overdue_only?: boolean;
  limit?: number;
  offset?: number;
}

function _capasQs(params: ListCapasParams): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.owner_user_id) search.set("owner_user_id", params.owner_user_id);
  if (params.overdue_only) search.set("overdue_only", "true");
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  const s = search.toString();
  return s ? `?${s}` : "";
}

export async function listCapas(
  params: ListCapasParams = {},
): Promise<CorrectiveActionListResponse> {
  return apiFetch<CorrectiveActionListResponse>(
    `/safety/corrective-actions${_capasQs(params)}`,
  );
}

export async function listMyCapas(
  params: Pick<ListCapasParams, "limit" | "offset"> = {},
): Promise<CorrectiveActionListResponse> {
  return apiFetch<CorrectiveActionListResponse>(
    `/safety/corrective-actions/mine${_capasQs(params)}`,
  );
}

export async function listCapasForSource(
  sourceType: CapaSourceType,
  sourceId: string,
): Promise<CorrectiveActionListResponse> {
  return apiFetch<CorrectiveActionListResponse>(
    `/safety/corrective-actions/for/${sourceType}/${sourceId}`,
  );
}

export async function getCapa(capaId: string): Promise<CorrectiveAction> {
  return apiFetch<CorrectiveAction>(`/safety/corrective-actions/${capaId}`);
}

export interface OpenCapaInput {
  source_type: CapaSourceType;
  source_id: string;
  title: string;
  description: string;
  owner_user_id: string;
  due_date: string; // YYYY-MM-DD
}

export async function openCapa(
  input: OpenCapaInput,
): Promise<CorrectiveAction> {
  return apiFetch<CorrectiveAction>("/safety/corrective-actions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateCapaNotes(
  capaId: string,
  notes: string,
): Promise<CorrectiveAction> {
  return apiFetch<CorrectiveAction>(
    `/safety/corrective-actions/${capaId}/notes`,
    {
      method: "PATCH",
      body: JSON.stringify({ notes }),
    },
  );
}

export interface UpdateCapaStatusInput {
  status?: CapaStatus;
  closed_reason?: string | null;
}

export async function updateCapaStatus(
  capaId: string,
  input: UpdateCapaStatusInput,
): Promise<CorrectiveAction> {
  return apiFetch<CorrectiveAction>(
    `/safety/corrective-actions/${capaId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}
