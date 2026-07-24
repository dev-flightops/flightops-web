/**
 * Typed wrapper around the maintenance-service airworthiness endpoint
 * (M2-M-8). Reads MEL items + open squawks for the aircraft and returns
 * a structured verdict + reasons.
 *
 * Backend classifies in one round-trip (one DB hit per table) — UI just
 * renders blocking_issues + advisory_issues based on the `kind`
 * discriminator. See lib/api/types.ts for the response shape.
 */

import { apiFetch } from "./client";
import type {
  AirworthinessResponse,
  FleetAirworthinessResponse,
  MelItemCloseRequest,
  MelItemCreateRequest,
  MelItemListResponse,
  MelItemResponse,
  MelStatus,
  SquawkCreateRequest,
  SquawkListResponse,
  SquawkResolveRequest,
  SquawkResponse,
  SquawkStatus,
} from "./types";

export interface ListMelItemsParams {
  aircraftId?: string;
  status?: MelStatus;
  limit?: number;
  offset?: number;
}

export async function listMelItems(
  params: ListMelItemsParams = {},
): Promise<MelItemListResponse> {
  const search = new URLSearchParams();
  if (params.aircraftId) search.set("aircraft_id", params.aircraftId);
  if (params.status) search.set("status", params.status);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<MelItemListResponse>(`/maintenance/mel-items${qs}`);
}

export interface ListSquawksParams {
  aircraftId?: string;
  status?: SquawkStatus;
  limit?: number;
  offset?: number;
}

export async function listSquawks(
  params: ListSquawksParams = {},
): Promise<SquawkListResponse> {
  const search = new URLSearchParams();
  if (params.aircraftId) search.set("aircraft_id", params.aircraftId);
  if (params.status) search.set("status", params.status);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<SquawkListResponse>(`/maintenance/squawks${qs}`);
}

export async function getAirworthiness(
  aircraftId: string,
): Promise<AirworthinessResponse> {
  return apiFetch<AirworthinessResponse>(
    `/maintenance/aircraft/${aircraftId}/airworthiness`,
  );
}

/** Bulk airworthiness summary for the Maintenance landing (M2-M-16).
 *  Returns one row per aircraft in the tenant with counts (no issue
 *  arrays) — drill into getAirworthiness(id) for the full verdict. */
export async function getFleetAirworthiness(): Promise<FleetAirworthinessResponse> {
  return apiFetch<FleetAirworthinessResponse>("/maintenance/airworthiness/fleet");
}

export async function createMelItem(
  payload: MelItemCreateRequest,
): Promise<MelItemResponse> {
  return apiFetch<MelItemResponse>(`/maintenance/mel-items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createSquawk(
  payload: SquawkCreateRequest,
): Promise<SquawkResponse> {
  return apiFetch<SquawkResponse>(`/maintenance/squawks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function closeMelItem(
  melItemId: string,
  payload: MelItemCloseRequest,
): Promise<MelItemResponse> {
  return apiFetch<MelItemResponse>(
    `/maintenance/mel-items/${melItemId}/close`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function resolveSquawk(
  squawkId: string,
  payload: SquawkResolveRequest,
): Promise<SquawkResponse> {
  return apiFetch<SquawkResponse>(
    `/maintenance/squawks/${squawkId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

// ---- Work Orders (M2 tail — flightops-services PR #113) --------------------

export type WorkOrderStatus =
  | "open"
  | "in_progress"
  | "awaiting_parts"
  | "completed"
  | "closed";

export type WorkOrderPriority = "normal" | "high" | "aog";

export interface WorkOrderRow {
  id: string;
  wo_number: string;
  aircraft_id: string;
  aircraft_tail: string | null;
  squawk_id: string | null;
  title: string;
  description: string | null;
  wo_type: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  opened_date: string;
  due_date: string | null;
  closed_date: string | null;
  opened_by_user_id: string;
  opened_by_name: string | null;
}

export interface WorkOrderListResponse {
  items: WorkOrderRow[];
  total: number;
}

export async function listWorkOrders(
  params: { status?: WorkOrderStatus; aircraftId?: string } = {},
): Promise<WorkOrderListResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.aircraftId) qs.set("aircraft_id", params.aircraftId);
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<WorkOrderListResponse>(`/maintenance/work-orders${tail}`);
}
