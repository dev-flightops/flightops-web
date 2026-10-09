/**
 * Typed wrapper for the passenger-manifest endpoints on ops-service.
 * Router is mounted at /manifest on the gateway (see infra/nginx/dev.conf).
 */

import { apiFetch } from "./client";

export type ManifestStatus = "draft" | "final";
export type TicketType =
  | "revenue"
  | "comp"
  | "employee"
  | "standby"
  | "cargo_only";
export type MailClass =
  | "bypass_mail"
  | "priority_mail"
  | "first_class"
  | "express_mail";

export interface ManifestPaxRow {
  id: string;
  manifest_id: string;
  first_name: string;
  last_name: string;
  weight_lbs: string;
  baggage_lbs: string;
  seat_number: string | null;
  ticket_type: TicketType;
  is_crew: boolean;
  is_unaccompanied_minor: boolean;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
}

export interface ManifestCargoRow {
  id: string;
  manifest_id: string;
  description: string;
  weight_lbs: string;
  pieces: number;
  mail_class: MailClass | null;
  is_hazmat: boolean;
  hazmat_notes: string | null;
  shipper: string | null;
  consignee: string | null;
  tracking_number: string | null;
  notes: string | null;
}

export interface ManifestTotals {
  pax_count: number;
  revenue_pax: number;
  crew_count: number;
  pax_weight_lbs: string;
  baggage_weight_lbs: string;
  /** Crew rows' weight and bags: never passengers or payload (#62). */
  crew_weight_lbs: string;
  cargo_weight_lbs: string;
  mail_weight_lbs: string;
  total_payload_lbs: string;
}

export interface ManifestDetailResponse {
  id: string;
  flight_id: string;
  status: ManifestStatus;
  locked_at: string | null;
  locked_by_user_id: string | null;
  notes: string | null;
  pax: ManifestPaxRow[];
  cargo: ManifestCargoRow[];
  totals: ManifestTotals;
}

export const TICKET_TYPES: readonly TicketType[] = [
  "revenue",
  "comp",
  "employee",
  "standby",
  "cargo_only",
];

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  revenue: "Revenue",
  comp: "Comp",
  employee: "Employee",
  standby: "Standby",
  cargo_only: "Cargo Only",
};

export const MAIL_CLASSES: readonly MailClass[] = [
  "bypass_mail",
  "priority_mail",
  "first_class",
  "express_mail",
];

/** Legacy's MAIL_CLASS_LABEL. */
export const MAIL_CLASS_LABELS: Record<MailClass, string> = {
  bypass_mail: "Bypass Mail",
  priority_mail: "Priority Mail",
  first_class: "First Class",
  express_mail: "Express Mail",
};

/** A mail line's description when nobody wrote one. Legacy's mail has no
 *  description; a FlightOps cargo line needs one. */
export function mailDescription(mailClass: MailClass): string {
  return `USPS ${MAIL_CLASS_LABELS[mailClass]}`;
}

/** Everything a passenger row holds. Sent whole on an edit too, so a
 *  field emptied in the form is cleared rather than left as it was. */
export interface PaxInput {
  first_name: string;
  last_name: string;
  weight_lbs: string;
  baggage_lbs: string;
  seat_number: string | null;
  ticket_type: TicketType;
  is_crew: boolean;
  is_unaccompanied_minor: boolean;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
}

/** A cargo line; a mail line is one with a mail class. */
export interface CargoInput {
  description: string;
  weight_lbs: string;
  pieces: number;
  mail_class: MailClass | null;
  is_hazmat: boolean;
  hazmat_notes: string | null;
  shipper: string | null;
  consignee: string | null;
  tracking_number: string | null;
  notes: string | null;
}

/** GET the manifest for a given flight. 404 if none created yet. */
export async function getFlightManifest(
  flightId: string,
): Promise<ManifestDetailResponse> {
  return apiFetch<ManifestDetailResponse>(`/manifest/flights/${flightId}`);
}

/** Start the flight's manifest, as a draft. 409 if it already has one. */
export async function createManifest(flightId: string): Promise<ManifestDetailResponse> {
  return apiFetch<ManifestDetailResponse>(`/manifest/flights/${flightId}`, { method: "POST" });
}

/** Make the manifest final. There is no unlock; check-in roles only. */
export async function lockManifest(flightId: string): Promise<ManifestDetailResponse> {
  return apiFetch<ManifestDetailResponse>(`/manifest/flights/${flightId}/lock`, {
    method: "POST",
  });
}

export async function addPax(flightId: string, pax: PaxInput): Promise<ManifestPaxRow> {
  return apiFetch<ManifestPaxRow>(`/manifest/flights/${flightId}/pax`, {
    method: "POST",
    body: JSON.stringify(pax),
  });
}

export async function updatePax(paxId: string, pax: PaxInput): Promise<ManifestPaxRow> {
  return apiFetch<ManifestPaxRow>(`/manifest/pax/${paxId}`, {
    method: "PATCH",
    body: JSON.stringify(pax),
  });
}

export async function deletePax(paxId: string): Promise<void> {
  return apiFetch<void>(`/manifest/pax/${paxId}`, { method: "DELETE" });
}

export async function addCargo(flightId: string, cargo: CargoInput): Promise<ManifestCargoRow> {
  return apiFetch<ManifestCargoRow>(`/manifest/flights/${flightId}/cargo`, {
    method: "POST",
    body: JSON.stringify(cargo),
  });
}

/** Partial: a mail line's form shows fewer fields than a cargo line has,
 *  and what it does not show is left as it was. */
export async function updateCargo(
  cargoId: string,
  cargo: Partial<CargoInput>,
): Promise<ManifestCargoRow> {
  return apiFetch<ManifestCargoRow>(`/manifest/cargo/${cargoId}`, {
    method: "PATCH",
    body: JSON.stringify(cargo),
  });
}

export async function deleteCargo(cargoId: string): Promise<void> {
  return apiFetch<void>(`/manifest/cargo/${cargoId}`, { method: "DELETE" });
}
