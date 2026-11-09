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
import type { PartShipment } from "./part-logistics";
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

export const WO_TYPES: readonly { value: string; label: string }[] = [
  { value: "corrective", label: "Corrective" },
  { value: "preventive", label: "Preventive" },
  { value: "inspection", label: "Inspection" },
  { value: "modification", label: "Modification" },
  { value: "airworthiness_directive", label: "Airworthiness directive" },
  { value: "service_bulletin", label: "Service bulletin" },
  { value: "other", label: "Other" },
];

export const WO_PRIORITIES: readonly { value: WorkOrderPriority; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "aog", label: "AOG" },
];

/** Where a work order can go next: maintenance-service's WO_TRANSITIONS. */
export const WO_NEXT: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  open: ["in_progress", "awaiting_parts", "closed"],
  in_progress: ["awaiting_parts", "completed", "closed"],
  awaiting_parts: ["in_progress", "closed"],
  completed: ["closed"],
  closed: [],
};

export interface WorkOrderEvent {
  id: string;
  from_status: WorkOrderStatus | null;
  to_status: WorkOrderStatus;
  changed_by_user_id: string;
  changed_by_name: string | null;
  note: string | null;
  /** Absent from an older backend. */
  changed_at?: string | null;
}

export interface WorkOrderDetail {
  work_order: WorkOrderRow;
  events: WorkOrderEvent[];
}

export interface WorkOrderCreate {
  aircraft_id: string;
  title: string;
  description?: string | null;
  wo_type: string;
  priority: WorkOrderPriority;
  opened_date: string;
  due_date?: string | null;
  squawk_id?: string | null;
}

export async function getWorkOrder(id: string): Promise<WorkOrderDetail> {
  return apiFetch<WorkOrderDetail>(`/maintenance/work-orders/${id}`);
}

export async function createWorkOrder(body: WorkOrderCreate): Promise<WorkOrderRow> {
  return apiFetch<WorkOrderRow>(`/maintenance/work-orders`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function transitionWorkOrder(
  id: string,
  toStatus: WorkOrderStatus,
  note: string | null,
): Promise<WorkOrderRow> {
  return apiFetch<WorkOrderRow>(`/maintenance/work-orders/${id}/transition`, {
    method: "POST",
    body: JSON.stringify({ to_status: toStatus, note }),
  });
}

export async function getSquawk(id: string): Promise<SquawkResponse> {
  return apiFetch<SquawkResponse>(`/maintenance/squawks/${id}`);
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

// ---- Parts (#172) ------------------------------------------------------------

export interface Part {
  id: string;
  part_number: string;
  description: string;
  category: string;
  manufacturer: string | null;
  unit_cost: number | null;
  unit: string;
  qty_on_hand: number;
  qty_minimum: number;
  /** On its way to this row: shipments ordered, shipped or in transit (#178). */
  incoming: number;
  /** A minimum, and at or below it counting what's on its way. */
  low_stock: boolean;
  /** The company base this stock is at (#178); `location` is the shelf or bin. */
  base: string | null;
  location: string | null;
  is_life_limited: boolean;
  shelf_life_months: number | null;
  expiration_date: string | null;
  expired: boolean;
  batch_number: string | null;
  lot_number: string | null;
  received_date: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface PartList {
  items: Part[];
  total: number;
  /** Across the whole inventory, whatever the filter shows. */
  low_count: number;
}

export type PartTransactionType = "received" | "issued" | "returned" | "adjustment" | "shipped";

export interface PartTransaction {
  id: string;
  txn_type: PartTransactionType;
  /** Signed: an issue is negative. */
  quantity: number;
  aircraft_id: string | null;
  aircraft_tail: string | null;
  work_order_id: string | null;
  wo_number: string | null;
  reference: string | null;
  batch_number: string | null;
  lot_number: string | null;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;
}

export interface PartDetail extends Part {
  transactions: PartTransaction[];
  /** Shipments from this row and to it, newest first (#178). */
  shipments: PartShipment[];
}

export interface PartInput {
  part_number: string;
  description: string;
  category: string;
  manufacturer: string | null;
  unit_cost: string | null;
  unit: string;
  qty_on_hand: string;
  qty_minimum: string;
  base: string | null;
  location: string | null;
  is_life_limited: boolean;
  shelf_life_months: number | null;
  expiration_date: string | null;
  batch_number: string | null;
  lot_number: string | null;
  received_date: string | null;
  notes: string | null;
}

export interface PartMove {
  txn_type: "received" | "issued" | "returned";
  quantity: string;
  aircraft_id?: string | null;
  work_order_id?: string | null;
  reference?: string | null;
  batch_number?: string | null;
  lot_number?: string | null;
  notes?: string | null;
}

export interface PartExpiration {
  today: string;
  expired: Part[];
  within_30: Part[];
  within_60: Part[];
  within_90: Part[];
}

export interface PartTraceRow extends PartTransaction {
  part_id: string;
  part_number: string;
  part_description: string;
}

export interface PartTrace {
  results: PartTraceRow[];
  affected_aircraft: { id: string; tail_number: string; model: string | null }[];
  /** For the batch box's suggestions. */
  batches: string[];
}

export async function listParts(
  params: { q?: string; category?: string; lowStock?: boolean; base?: string } = {},
): Promise<PartList> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.category) qs.set("category", params.category);
  if (params.lowStock) qs.set("low_stock", "true");
  if (params.base) qs.set("base", params.base);
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<PartList>(`/maintenance/parts${tail}`);
}

export async function listPartCategories(): Promise<{ value: string; label: string }[]> {
  return apiFetch(`/maintenance/parts/categories`);
}

/** Settings → Bases, for the base pickers (#178). Empty when none are listed:
 *  the forms then take a typed code. */
export interface CompanyBaseOption {
  code: string;
  name: string;
}

export async function listPartBases(): Promise<CompanyBaseOption[]> {
  return apiFetch<CompanyBaseOption[]>(`/maintenance/parts/bases`);
}

export async function lookupPart(code: string): Promise<Part[]> {
  return apiFetch<Part[]>(`/maintenance/parts/lookup?code=${encodeURIComponent(code)}`);
}

export async function getPartExpiration(): Promise<PartExpiration> {
  return apiFetch<PartExpiration>(`/maintenance/parts/expiration`);
}

export async function tracePart(params: { batch?: string; lot?: string } = {}): Promise<PartTrace> {
  const qs = new URLSearchParams();
  if (params.batch) qs.set("batch", params.batch);
  if (params.lot) qs.set("lot", params.lot);
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<PartTrace>(`/maintenance/parts/trace${tail}`);
}

export async function getPart(id: string): Promise<PartDetail> {
  return apiFetch<PartDetail>(`/maintenance/parts/${id}`);
}

export async function createPart(body: PartInput): Promise<Part> {
  return apiFetch<Part>(`/maintenance/parts`, { method: "POST", body: JSON.stringify(body) });
}

export async function updatePart(id: string, body: PartInput): Promise<Part> {
  return apiFetch<Part>(`/maintenance/parts/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function removePart(id: string): Promise<void> {
  await apiFetch<void>(`/maintenance/parts/${id}`, { method: "DELETE" });
}

export async function movePart(id: string, body: PartMove): Promise<Part> {
  return apiFetch<Part>(`/maintenance/parts/${id}/transactions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---- The maintenance clock (#172) --------------------------------------------

export interface MxClock {
  id: string;
  aircraft: { id: string; tail_number: string; model: string | null; airframe_type: string | null };
  work_order_id: string | null;
  wo_number: string | null;
  status: "active" | "completed";
  started_at: string;
  completed_at: string | null;
  total_hours: number | null;
  elapsed_hours: number;
  started_by: string;
  notes: string | null;
  milestones: { key: string; label: string; at: string | null }[];
  mechanics: { user_id: string; name: string; clocked_in: string }[];
  /** The viewer is on this clock now. */
  on_clock: boolean;
}

export interface MxClockList {
  active: MxClock[];
  recent: MxClock[];
}

export async function listMxClocks(): Promise<MxClockList> {
  return apiFetch<MxClockList>(`/maintenance/mx-clocks`);
}

export async function startMxClock(body: {
  aircraft_id: string;
  work_order_id: string | null;
  notes: string | null;
}): Promise<MxClock> {
  return apiFetch<MxClock>(`/maintenance/mx-clocks`, { method: "POST", body: JSON.stringify(body) });
}

export async function stampMxMilestone(id: string, milestone: string): Promise<MxClock> {
  return apiFetch<MxClock>(`/maintenance/mx-clocks/${id}/milestones`, {
    method: "POST",
    body: JSON.stringify({ milestone }),
  });
}

export async function moveOnMxClock(id: string, move: "join" | "leave" | "complete"): Promise<MxClock> {
  return apiFetch<MxClock>(`/maintenance/mx-clocks/${id}/${move}`, { method: "POST" });
}

// ---- Availability (#172) -----------------------------------------------------

export interface AvailabilityRow {
  aircraft_id: string;
  tail_number: string;
  model: string | null;
  airframe_type: string | null;
  availability_pct: number;
  revenue_hours: number;
  mx_hours: number;
  non_revenue_hours: number;
  idle_hours: number;
  flights: number;
  mx_events: number;
  status: "in_mx" | "on_hold" | "available";
}

export interface AvailabilityReport {
  start: string;
  end: string;
  period_days: number;
  fleet_availability_pct: number;
  revenue_hours: number;
  mx_hours: number;
  rows: AvailabilityRow[];
}

export async function getAvailability(
  params: { start?: string; end?: string } = {},
): Promise<AvailabilityReport> {
  const qs = new URLSearchParams();
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<AvailabilityReport>(`/maintenance/availability${tail}`);
}

// ---- Return to Service (#172) ------------------------------------------------

export interface RtsAircraft {
  id: string;
  tail_number: string;
  model: string | null;
  airframe_type: string | null;
  base: string | null;
}

export interface RtsSquawk {
  id: string;
  aircraft: RtsAircraft;
  reported_at: string;
  reported_by: string;
  title: string;
  description: string;
  severity: "minor" | "major" | "grounding";
  status: "open" | "in_progress" | "resolved";
  is_rii: boolean;
  work_order: { id: string; wo_number: string; status: WorkOrderStatus } | null;
  rts_submitted_at: string | null;
  /** The viewer signed the work, so may not inspect it. */
  signed_by_me: boolean;
  rts_work_notes: string | null;
  rts_amt_name: string | null;
  rts_amt_cert_number: string | null;
  rts_amt_cert_type: string | null;
  rts_rejection_notes: string | null;
}

export interface RtsQueue {
  pending_rii: RtsSquawk[];
  pending_rts: RtsSquawk[];
  open_on_hold: RtsSquawk[];
  held_aircraft: { aircraft: RtsAircraft; reasons: string[] }[];
}

export type CertType = "ap" | "ia" | "repairman";

export interface RtsSignOff {
  work_notes: string;
  amt_name: string;
  cert_number: string;
  cert_type: CertType;
  airworthy: true;
  is_rii: boolean;
}

export interface RtsInspection {
  inspector_name: string;
  cert_number: string;
  notes: string | null;
  confirmed: true;
}

export interface RtsDeferral {
  defer_type: "mel" | "dmi";
  reason: string;
  mel_category: "A" | "B" | "C" | "D" | null;
  ata_chapter: string | null;
  reference: string | null;
  due_on: string | null;
}

export async function getRtsQueue(): Promise<RtsQueue> {
  return apiFetch<RtsQueue>(`/maintenance/rts/queue`);
}

export async function signOffSquawk(id: string, body: RtsSignOff): Promise<SquawkResponse> {
  return apiFetch<SquawkResponse>(`/maintenance/squawks/${id}/rts/sign-off`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function inspectSquawk(id: string, body: RtsInspection): Promise<SquawkResponse> {
  return apiFetch<SquawkResponse>(`/maintenance/squawks/${id}/rts/rii`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function rejectSquawkSignOff(id: string, reason: string): Promise<SquawkResponse> {
  return apiFetch<SquawkResponse>(`/maintenance/squawks/${id}/rts/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function deferSquawk(id: string, body: RtsDeferral): Promise<SquawkResponse> {
  return apiFetch<SquawkResponse>(`/maintenance/squawks/${id}/rts/defer`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
