/**
 * Inspections (#178): an inspection of one aircraft and its checklist. The
 * maintenance service's /inspections.
 *
 * A failed item opens a squawk on the aircraft and reads corrected once that
 * squawk is resolved. An inspection is finished by a sign-off with the
 * signer's certificate, which can record the due-list item it satisfies.
 */

import { apiFetch } from "./client";

export type InspectionStatus = "open" | "in_progress" | "signed_off" | "cancelled";
export type InspectionView = "active" | "ready" | "signed_off" | "cancelled";
export type InspectionItemState = "pending" | "pass" | "fail" | "corrected";
export type CertType = "ap" | "ia" | "repairman";

export interface InspectionProgress {
  total: number;
  passed: number;
  corrected: number;
  open_discrepancies: number;
  pending: number;
  pct: number;
  /** Every item passed or corrected, and there is at least one. */
  ready: boolean;
}

export interface InspectionSummary {
  id: string;
  aircraft_id: string;
  tail_number: string;
  aircraft_model: string | null;
  inspection_type: string;
  type_label: string;
  title: string;
  status: InspectionStatus;
  started_on: string;
  target_on: string | null;
  aircraft_hours_at_start: number | null;
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  work_order_id: string | null;
  wo_number: string | null;
  notes: string | null;
  progress: InspectionProgress;
  signed_off_on: string | null;
  signed_off_at: string | null;
  signer_name: string | null;
  cert_number: string | null;
  cert_type: CertType | null;
  total_time_hours: number | null;
  sign_off_notes: string | null;
  due_item_id: string | null;
  due_item_title: string | null;
}

export interface InspectionItem {
  id: string;
  section: string;
  item_number: string | null;
  description: string;
  status: "pending" | "pass" | "fail";
  state: InspectionItemState;
  finding: string | null;
  squawk_id: string | null;
  squawk_status: string | null;
  squawk_severity: string | null;
  marked_by_name: string | null;
  marked_at: string | null;
}

export interface InspectionDetail extends InspectionSummary {
  items: InspectionItem[];
  aircraft_total_hours: number | null;
}

export interface InspectionList {
  items: InspectionSummary[];
  counts: Record<InspectionView, number>;
}

export interface InspectionDetailsInput {
  inspection_type: string;
  title: string;
  target_on: string | null;
  assigned_to_user_id: string | null;
  vendor_id: string | null;
  work_order_id: string | null;
  notes: string | null;
}

export interface InspectionCreateInput extends InspectionDetailsInput {
  aircraft_id: string;
  started_on: string | null;
}

export interface InspectionSignOffInput {
  signed_off_on: string | null;
  signer_name: string;
  cert_number: string;
  cert_type: CertType;
  total_time_hours: number | null;
  notes: string | null;
  due_item_id: string | null;
}

export async function listInspections(view: InspectionView = "active"): Promise<InspectionList> {
  return apiFetch<InspectionList>(`/maintenance/inspections?view=${view}`);
}

export async function listInspectionTypes(): Promise<{ value: string; label: string }[]> {
  return apiFetch(`/maintenance/inspections/types`);
}

export async function getInspection(id: string): Promise<InspectionDetail> {
  return apiFetch<InspectionDetail>(`/maintenance/inspections/${id}`);
}

export async function startInspection(body: InspectionCreateInput): Promise<InspectionDetail> {
  return apiFetch<InspectionDetail>(`/maintenance/inspections`, { method: "POST", body: JSON.stringify(body) });
}

export async function updateInspection(id: string, body: InspectionDetailsInput): Promise<InspectionDetail> {
  return apiFetch<InspectionDetail>(`/maintenance/inspections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function cancelInspection(id: string): Promise<InspectionDetail> {
  return apiFetch<InspectionDetail>(`/maintenance/inspections/${id}/cancel`, { method: "POST" });
}

export async function addInspectionItem(
  id: string,
  body: { section: string; item_number: string | null; description: string },
): Promise<InspectionDetail> {
  return apiFetch<InspectionDetail>(`/maintenance/inspections/${id}/items`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function removeInspectionItem(id: string, itemId: string): Promise<void> {
  await apiFetch<void>(`/maintenance/inspections/${id}/items/${itemId}`, { method: "DELETE" });
}

export async function passInspectionItem(id: string, itemId: string): Promise<InspectionDetail> {
  return apiFetch<InspectionDetail>(`/maintenance/inspections/${id}/items/${itemId}/pass`, { method: "POST" });
}

export async function failInspectionItem(
  id: string,
  itemId: string,
  body: { finding: string; severity: "minor" | "major" | "grounding" },
): Promise<InspectionDetail> {
  return apiFetch<InspectionDetail>(`/maintenance/inspections/${id}/items/${itemId}/fail`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function signOffInspection(id: string, body: InspectionSignOffInput): Promise<InspectionDetail> {
  return apiFetch<InspectionDetail>(`/maintenance/inspections/${id}/sign-off`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
