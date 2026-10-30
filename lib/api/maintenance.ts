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
  /** Past its due date and not completed or closed (#156). */
  is_overdue?: boolean;
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

// ---- The due list (#156) -----------------------------------------------------

export type DueItemKind = "inspection" | "ad" | "sb" | "component" | "calendar" | "other";
export type DueState = "overdue" | "due_soon" | "current" | "not_scheduled";

export const DUE_ITEM_KINDS: { value: DueItemKind; label: string }[] = [
  { value: "inspection", label: "Inspection" },
  { value: "ad", label: "Airworthiness directive" },
  { value: "sb", label: "Service bulletin" },
  { value: "component", label: "Life-limited component" },
  { value: "calendar", label: "Calendar item" },
  { value: "other", label: "Other" },
];

/** One item on an aircraft's due list, with where it stands today. */
export interface DueItem {
  id: string;
  aircraft_id: string;
  tail_number: string;
  kind: DueItemKind;
  title: string;
  reference: string | null;
  interval_hours: number | null;
  interval_days: number | null;
  due_hours: number | null;
  due_on: string | null;
  last_done_on: string | null;
  last_done_hours: number | null;
  grounds_when_overdue: boolean;
  is_active: boolean;
  notes: string | null;
  state: DueState;
  /** Aircraft hours until due, negative once past. */
  hours_left: number | null;
  /** Days until due, negative once past. */
  days_left: number | null;
  /** "100-hour inspection: 7.5 hours overdue". */
  summary: string;
  aircraft_total_hours: number;
}

export interface DueItemList {
  items: DueItem[];
  total: number;
  /** The company's date the states were worked out on. */
  as_of: string;
}

export interface DueItemInput {
  kind: DueItemKind;
  title: string;
  reference?: string | null;
  interval_hours?: number | null;
  interval_days?: number | null;
  due_hours?: number | null;
  due_on?: string | null;
  last_done_on?: string | null;
  last_done_hours?: number | null;
  grounds_when_overdue?: boolean;
  notes?: string | null;
}

export interface DueItemSignOff {
  done_on: string;
  done_hours?: number | null;
  done_by_name: string;
  certificate_number?: string | null;
  notes?: string | null;
}

export interface DueItemCompletion {
  id: string;
  item_id: string;
  done_on: string;
  done_hours: number | null;
  done_by_name: string;
  certificate_number: string | null;
  work_order_id: string | null;
  notes: string | null;
  next_due_hours: number | null;
  next_due_on: string | null;
  recorded_by_name: string | null;
}

export async function listDueList(
  params: { aircraftId?: string; state?: DueState } = {},
): Promise<DueItemList> {
  const qs = new URLSearchParams();
  if (params.aircraftId) qs.set("aircraft_id", params.aircraftId);
  if (params.state) qs.set("state", params.state);
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<DueItemList>(`/maintenance/due-list${tail}`);
}

export async function listAircraftDueItems(aircraftId: string): Promise<DueItemList> {
  return apiFetch<DueItemList>(`/maintenance/aircraft/${aircraftId}/due-items`);
}

export async function addDueItem(aircraftId: string, body: DueItemInput): Promise<DueItem> {
  return apiFetch<DueItem>(`/maintenance/aircraft/${aircraftId}/due-items`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateDueItem(
  itemId: string,
  body: Partial<DueItemInput> & { is_active?: boolean },
): Promise<DueItem> {
  return apiFetch<DueItem>(`/maintenance/due-items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function signOffDueItem(itemId: string, body: DueItemSignOff): Promise<DueItem> {
  return apiFetch<DueItem>(`/maintenance/due-items/${itemId}/complete`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listDueItemCompletions(itemId: string): Promise<DueItemCompletion[]> {
  return (
    await apiFetch<{ items: DueItemCompletion[] }>(`/maintenance/due-items/${itemId}/completions`)
  ).items;
}
