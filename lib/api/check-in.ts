/**
 * Gate check-in (#103): ops `/check-in/*` for a flight's passengers, and
 * ground `/checkin/*` for the company's check-in settings.
 *
 * The client, 22 Oct 2026: "Can you tell me how a gate agent checks
 * people in for a flight?" Legacy's check-in (`modules/checkin`), on the
 * manifest's passengers: our bookings carry a count, not names. Every
 * step answers with the whole check-in, so the page re-renders from what
 * the server now holds.
 *
 * Weights are backend Decimals and arrive as strings, as on the manifest.
 */

import { apiFetch } from "./client";
import type { ManifestLoad, TicketType } from "./manifest";

export type CheckInStatus = "booked" | "checked_in" | "boarded" | "no_show";
export type NoShowReason =
  | "did_not_appear"
  | "cancelled_at_gate"
  | "missed_connection"
  | "standby_no_seat"
  | "other";
export type CheckInFieldType = "text" | "number" | "checkbox" | "dropdown";

export interface CheckInPax {
  id: string;
  first_name: string;
  last_name: string;
  seat_number: string | null;
  ticket_type: TicketType;
  is_unaccompanied_minor: boolean;
  contact_phone: string | null;
  notes: string | null;
  /** What was weighed once checked in; the booked figures are then in
   *  planned_*. */
  weight_lbs: string;
  baggage_lbs: string;
  planned_weight_lbs: string | null;
  planned_baggage_lbs: string | null;
  bags_count: number | null;
  check_in_status: CheckInStatus;
  /** Booked on a standby ticket, waiting for a seat. */
  standby: boolean;
  id_verified: boolean;
  hazmat_declared: boolean;
  hazmat_notes: string | null;
  custom_fields: Record<string, string | number | boolean>;
  checked_in_at: string | null;
  checked_in_by_name: string | null;
  boarded_at: string | null;
  no_show_reason: NoShowReason | null;
  no_show_notes: string | null;
  no_show_at: string | null;
  no_show_fee: string | null;
}

export interface CheckInRules {
  require_actual_weight: boolean;
  require_actual_bag_weight: boolean;
  require_bags_count: boolean;
  require_id_verification: boolean;
  require_hazmat_declaration: boolean;
  require_seat_assignment: boolean;
  no_show_fee: string | null;
  standby_enabled: boolean;
  allow_walk_up: boolean;
  lock_manifest_on_close: boolean;
}

export interface CheckInField {
  field_key: string;
  field_label: string;
  field_type: CheckInFieldType;
  options: string[];
  is_required: boolean;
  help_text: string | null;
}

export interface CheckInView {
  flight_id: string;
  flight_number: string;
  origin: string;
  destination: string;
  scheduled_departure_at: string;
  flight_status: string;
  tail_number: string | null;
  /** Null until the flight has a manifest. */
  manifest_id: string | null;
  manifest_status: "draft" | "final" | null;
  locked_at: string | null;
  boarding_opened_at: string | null;
  boarding_closed_at: string | null;
  rules: CheckInRules;
  fields: CheckInField[];
  no_show_reasons: { code: NoShowReason; label: string }[];
  passengers: CheckInPax[];
  counts: {
    booked: number;
    checked_in: number;
    boarded: number;
    no_show: number;
    standby: number;
    total: number;
  };
  weights: {
    planned_pax_lbs: string;
    planned_bags_lbs: string;
    actual_pax_lbs: string;
    actual_bags_lbs: string;
  };
  /** What is left of the aircraft's useful load with the weights weighed
   *  here (#146); null until there is a manifest. Boarding is refused
   *  while `remaining_lbs` is below zero. Absent from services before #146. */
  load?: ManifestLoad | null;
}

export interface CheckInInput {
  first_name?: string;
  last_name?: string;
  actual_weight_lbs?: number | null;
  actual_baggage_lbs?: number | null;
  bags_count?: number | null;
  seat_number?: string | null;
  id_verified: boolean;
  /** null: the question was not answered. */
  hazmat_declared: boolean | null;
  hazmat_notes?: string | null;
  custom_fields?: Record<string, string | number | boolean>;
}

export async function getCheckIn(flightId: string): Promise<CheckInView> {
  return apiFetch<CheckInView>(`/ops/check-in/flights/${flightId}`);
}

function post(path: string, body?: unknown): Promise<CheckInView> {
  return apiFetch<CheckInView>(`/ops/check-in${path}`, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// `at`: when the step was taken, for one kept on a phone without signal
// and sent later (#119); the check-in records it. Absent is now.
const when = (at?: string) => (at ? { at } : undefined);

export const checkInPax = (paxId: string, input: CheckInInput, at?: string) =>
  post(`/pax/${paxId}/check-in`, { ...input, ...when(at) });
export const promoteStandby = (paxId: string, at?: string) =>
  post(`/pax/${paxId}/promote`, when(at));
export const markNoShow = (paxId: string, reason: NoShowReason, notes: string | null, at?: string) =>
  post(`/pax/${paxId}/no-show`, { reason, notes, ...when(at) });
export const boardPax = (paxId: string, at?: string) => post(`/pax/${paxId}/board`, when(at));
export const resetPax = (paxId: string) => post(`/pax/${paxId}/reset`);
export const openBoarding = (flightId: string, at?: string) =>
  post(`/flights/${flightId}/boarding/open`, when(at));
export const closeBoarding = (flightId: string) => post(`/flights/${flightId}/boarding/close`);

// ---- Settings → Check-in (ground) ----------------------------------------------------

export interface CheckInConfig {
  id: string;
  require_actual_weight: boolean;
  require_actual_bag_weight: boolean;
  require_bags_count: boolean;
  require_id_verification: boolean;
  require_hazmat_declaration: boolean;
  require_seat_assignment: boolean;
  no_show_fee_enabled: boolean;
  no_show_fee_amount: number | null;
  standby_enabled: boolean;
  allow_walk_up: boolean;
  lock_manifest_on_close: boolean;
}

export type CheckInConfigUpdate = Partial<Omit<CheckInConfig, "id">>;

export interface CheckInCustomField {
  id: string;
  field_key: string;
  field_label: string;
  field_type: CheckInFieldType;
  /** Dropdown options, one per line. */
  field_options: string | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  help_text: string | null;
}

export interface CheckInCustomFieldInput {
  field_key: string;
  field_label: string;
  field_type: CheckInFieldType;
  field_options?: string | null;
  is_required?: boolean;
  sort_order?: number;
  help_text?: string | null;
}

export async function getCheckInConfig(): Promise<CheckInConfig> {
  return apiFetch<CheckInConfig>("/ground/checkin/config");
}

export async function updateCheckInConfig(patch: CheckInConfigUpdate): Promise<CheckInConfig> {
  return apiFetch<CheckInConfig>("/ground/checkin/config", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function listCheckInFields(): Promise<CheckInCustomField[]> {
  const res = await apiFetch<{ items: CheckInCustomField[] }>(
    "/ground/checkin/custom-fields?include_inactive=true",
  );
  return res.items;
}

export async function createCheckInField(input: CheckInCustomFieldInput): Promise<CheckInCustomField> {
  return apiFetch<CheckInCustomField>("/ground/checkin/custom-fields", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateCheckInField(
  id: string,
  patch: Partial<CheckInCustomFieldInput> & { is_active?: boolean },
): Promise<CheckInCustomField> {
  return apiFetch<CheckInCustomField>(`/ground/checkin/custom-fields/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
