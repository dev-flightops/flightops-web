/**
 * Shipping and Parts Requests (#178): parts on their way to a base, and one
 * base asking another for stock. The maintenance service's /part-shipments and
 * /part-requests.
 *
 * Between bases, stock moves row to row: off the sending base's row when it
 * ships, onto the receiving base's row of the same part number and batch when
 * it arrives. What's on its way counts toward the receiving row's low stock.
 */

import { apiFetch } from "./client";

export type ShipmentKind = "transfer" | "vendor";
export type ShipmentStatus = "ordered" | "shipped" | "in_transit" | "arrived" | "cancelled";
export type ShipmentView = "open" | "arrived" | "cancelled" | "all";

export interface PartShipment {
  id: string;
  kind: ShipmentKind;
  status: ShipmentStatus;
  /** Between bases, the sending row; from a vendor, the row it's for. */
  part_id: string;
  dest_part_id: string | null;
  part_number: string;
  description: string;
  unit: string;
  batch_number: string | null;
  lot_number: string | null;
  quantity: number;
  origin_base: string | null;
  dest_base: string;
  vendor_id: string | null;
  vendor_name: string | null;
  airway_bill: string | null;
  carrier: string | null;
  shipped_on: string | null;
  est_arrival_on: string | null;
  arrived_on: string | null;
  work_order_id: string | null;
  wo_number: string | null;
  notes: string | null;
  request_id: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface ShipmentInput {
  kind: ShipmentKind;
  part_id: string;
  quantity: string;
  dest_base?: string | null;
  vendor_id?: string | null;
  status?: "ordered" | "shipped";
  airway_bill?: string | null;
  carrier?: string | null;
  shipped_on?: string | null;
  est_arrival_on?: string | null;
  work_order_id?: string | null;
  notes?: string | null;
}

export interface ShipmentStatusInput {
  status: "shipped" | "in_transit" | "arrived" | "cancelled";
  /** The ship date for shipped, the arrival date for arrived: today when left out. */
  on?: string | null;
  airway_bill?: string | null;
  carrier?: string | null;
  notes?: string | null;
}

export async function listShipments(view: ShipmentView = "open"): Promise<PartShipment[]> {
  return apiFetch<PartShipment[]>(`/maintenance/part-shipments?view=${view}`);
}

export async function createShipment(body: ShipmentInput): Promise<PartShipment> {
  return apiFetch<PartShipment>(`/maintenance/part-shipments`, { method: "POST", body: JSON.stringify(body) });
}

export async function updateShipmentStatus(id: string, body: ShipmentStatusInput): Promise<PartShipment> {
  return apiFetch<PartShipment>(`/maintenance/part-shipments/${id}/status`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type PartRequestStatus = "pending" | "approved" | "denied" | "shipped" | "fulfilled" | "cancelled";
export type PartRequestPriority = "normal" | "urgent" | "aog";
export type PartRequestView = "open" | "closed" | "all";

export interface PartRequest {
  id: string;
  status: PartRequestStatus;
  priority: PartRequestPriority;
  part_id: string;
  part_number: string;
  description: string;
  unit: string;
  batch_number: string | null;
  lot_number: string | null;
  /** On hand now at the base that would send it. */
  on_hand: number;
  quantity: number;
  requesting_base: string;
  fulfilling_base: string | null;
  work_order_id: string | null;
  wo_number: string | null;
  notes: string | null;
  requested_by_name: string | null;
  requested_at: string;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  shipment_id: string | null;
  shipment_status: ShipmentStatus | null;
  airway_bill: string | null;
}

export interface PartRequestInput {
  part_id: string;
  quantity: string;
  requesting_base: string;
  priority: PartRequestPriority;
  work_order_id?: string | null;
  notes?: string | null;
}

export interface PartRequestShipInput {
  airway_bill?: string | null;
  carrier?: string | null;
  shipped_on?: string | null;
  est_arrival_on?: string | null;
}

export async function listPartRequests(view: PartRequestView = "open"): Promise<PartRequest[]> {
  return apiFetch<PartRequest[]>(`/maintenance/part-requests?view=${view}`);
}

export async function createPartRequest(body: PartRequestInput): Promise<PartRequest> {
  return apiFetch<PartRequest>(`/maintenance/part-requests`, { method: "POST", body: JSON.stringify(body) });
}

export async function approvePartRequest(id: string, notes: string | null): Promise<PartRequest> {
  return apiFetch<PartRequest>(`/maintenance/part-requests/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export async function denyPartRequest(id: string, notes: string): Promise<PartRequest> {
  return apiFetch<PartRequest>(`/maintenance/part-requests/${id}/deny`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export async function shipPartRequest(id: string, body: PartRequestShipInput): Promise<PartRequest> {
  return apiFetch<PartRequest>(`/maintenance/part-requests/${id}/ship`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function cancelPartRequest(id: string): Promise<PartRequest> {
  return apiFetch<PartRequest>(`/maintenance/part-requests/${id}/cancel`, { method: "POST" });
}
