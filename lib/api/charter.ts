/**
 * Charter Pipeline API — wraps reservations-service /charter/*
 * (flightops-services PR #119).
 *
 *   GET  /reservations/charter                       list (?status=)
 *   POST /reservations/charter                       create (starts in `request`)
 *   GET  /reservations/charter/{id}                  detail
 *   PATCH /reservations/charter/{id}                 edit (blocked on completed/cancelled)
 *   POST /reservations/charter/{id}/transition       legal-transition state machine
 *
 * Legal transitions (backend enforces; UI mirrors for button state):
 *   request     -> quoted, cancelled
 *   quoted      -> confirmed, cancelled
 *   confirmed   -> dispatched, cancelled
 *   dispatched  -> completed, cancelled
 */

import { apiFetch } from "./client";

export type CharterStatus =
  | "request"
  | "quoted"
  | "confirmed"
  | "dispatched"
  | "completed"
  | "cancelled";

export const CHARTER_STATUSES: readonly CharterStatus[] = [
  "request",
  "quoted",
  "confirmed",
  "dispatched",
  "completed",
  "cancelled",
];

export const CHARTER_STATUS_LABELS: Record<CharterStatus, string> = {
  request: "Request",
  quoted: "Quoted",
  confirmed: "Confirmed",
  dispatched: "Dispatched",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * Post-transition targets legal from each status. Cancel is
 * available from every non-terminal state; forward-only otherwise.
 */
export const CHARTER_LEGAL_NEXT: Record<CharterStatus, CharterStatus[]> = {
  request: ["quoted", "cancelled"],
  quoted: ["confirmed", "cancelled"],
  confirmed: ["dispatched", "cancelled"],
  dispatched: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export interface CharterRow {
  id: string;
  customer_id: string;
  customer_name: string | null;
  origin_icao: string;
  destination_icao: string;
  requested_date: string; // YYYY-MM-DD
  requested_time: string | null;
  return_date: string | null;
  return_time: string | null;
  pax_count: number;
  cargo_lbs: string; // decimal serialized as string
  aircraft_type_requested: string | null;
  special_requirements: string | null;
  status: CharterStatus;
  flight_id: string | null;
  quoted_total_cents: number | null;
  notes: string | null;
}

export interface CharterListResponse {
  items: CharterRow[];
}

export interface CharterCreateRequest {
  customer_id: string;
  origin_icao: string;
  destination_icao: string;
  requested_date: string;
  requested_time?: string;
  return_date?: string;
  return_time?: string;
  pax_count?: number;
  cargo_lbs?: string;
  aircraft_type_requested?: string;
  special_requirements?: string;
  notes?: string;
}

export async function listCharters(
  params: { status?: CharterStatus; limit?: number } = {},
): Promise<CharterListResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<CharterListResponse>(`/reservations/charter${suffix}`);
}

export async function createCharter(
  body: CharterCreateRequest,
): Promise<CharterRow> {
  return apiFetch<CharterRow>("/reservations/charter", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function transitionCharter(
  charterId: string,
  toStatus: CharterStatus,
): Promise<CharterRow> {
  return apiFetch<CharterRow>(
    `/reservations/charter/${charterId}/transition`,
    {
      method: "POST",
      body: JSON.stringify({ to_status: toStatus }),
    },
  );
}
