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

/** GET the manifest for a given flight. 404 if none created yet. */
export async function getFlightManifest(
  flightId: string,
): Promise<ManifestDetailResponse> {
  return apiFetch<ManifestDetailResponse>(`/manifest/flights/${flightId}`);
}
