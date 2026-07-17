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
