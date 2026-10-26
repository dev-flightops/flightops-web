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
  /** Where they are at gate check-in (#103); a no-show is out of the
   *  totals. Absent from servers that predate it. */
  check_in_status?: "booked" | "checked_in" | "boarded" | "no_show";
  no_show_reason?: string | null;
  /** The stops they get on and off at (#120); null is the flight's
   *  origin / destination. Absent from servers that predate it. */
  boards_at?: string | null;
  leaves_at?: string | null;
  /** Legacy's waitlist: waiting for a seat on a full flight (#120). */
  is_waitlist?: boolean;
}

/** One leg's seats (#120): held by passengers aboard on it, and open
 *  against the aircraft's passenger seats (null when not recorded). */
export interface LegSeats {
  origin: string;
  destination: string;
  held: number;
  open: number | null;
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
  /** The waiting load it was taken from (#75), if any. */
  waiting_load_id?: string | null;
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

/** The trip fuel ops works out when dispatch hasn't entered planned fuel
 *  (#75): burn × (flight time, doubled for a round trip, + reserve). */
export interface FuelEstimate {
  lbs: string | null;
  gallons: string | null;
  burn_gph: string | null;
  fuel_type_code: string | null;
  /** One way, from the flight's schedule. */
  flight_minutes: number | null;
  round_trip: boolean;
  reserve_minutes: number;
  /** What it needs and doesn't have, in words a dispatcher can act on. */
  missing: string[];
}

/** What is left of the aircraft's useful load for mail and freight (#74):
 *  useful load − crew − fuel − payload. */
export interface ManifestLoad {
  /** The aircraft's useful load; null when it isn't set. */
  useful_load_lbs: number | null;
  crew_lbs: string;
  /** "manifest": crew rows' own weights. "standard": the flight's assigned
   *  crew at standard weights. "none": no crew anywhere. */
  crew_basis: "manifest" | "standard" | "none";
  crew_count: number;
  /** The planned fuel, else the trip's estimate (#75); null when neither. */
  fuel_lbs: string | null;
  payload_lbs: string;
  /** Null without a useful load; before fuel while fuel_counted is false. */
  remaining_lbs: string | null;
  fuel_counted: boolean;
  /** Where the fuel figure came from (#75). */
  fuel_basis?: "planned" | "estimated" | null;
  fuel_estimate?: FuelEstimate | null;
  /** From the aircraft's weight and balance record, when both are
   *  recorded; the useful load is then their difference (#111). */
  max_gross_weight_lbs?: number | null;
  empty_weight_lbs?: number | null;
}

export interface PassengerTally {
  count: number;
  weight_lbs: string;
  baggage_lbs: string;
}

/** `GET /manifest/flights/{id}/load` (#111): the pilot's weight and
 *  balance, before or after there is a manifest. */
export interface FlightLoad {
  flight_id: string;
  has_manifest: boolean;
  /** The flight's booked passenger count, for when there is no manifest. */
  booked_passengers: number;
  /** Checked in or boarded, at their weighed weights (#103). */
  checked_in: PassengerTally;
  /** Still to check in, at their booked weights. */
  to_check_in: PassengerTally;
  cargo_lbs: string;
  load: ManifestLoad;
}

export interface ManifestDetailResponse {
  id: string;
  flight_id: string;
  status: ManifestStatus;
  locked_at: string | null;
  locked_by_user_id: string | null;
  notes: string | null;
  planned_fuel_lbs: string | null;
  pax: ManifestPaxRow[];
  cargo: ManifestCargoRow[];
  totals: ManifestTotals;
  load: ManifestLoad;
  /** Seats on each leg, in route order (#120). */
  legs?: LegSeats[];
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
  /** Left out: the flight's origin / destination, not on the waitlist. */
  boards_at?: string | null;
  leaves_at?: string | null;
  is_waitlist?: boolean;
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

/** The pilot's weight and balance for a flight (#111), manifest or not. */
export async function getFlightLoad(flightId: string): Promise<FlightLoad> {
  return apiFetch<FlightLoad>(`/manifest/flights/${flightId}/load`);
}

/** Start the flight's manifest, as a draft. 409 if it already has one. */
export async function createManifest(flightId: string): Promise<ManifestDetailResponse> {
  return apiFetch<ManifestDetailResponse>(`/manifest/flights/${flightId}`, { method: "POST" });
}

/** Set the fuel dispatch plans to carry, in pounds; null clears it (#74). */
export async function setPlannedFuel(
  flightId: string,
  plannedFuelLbs: string | null,
): Promise<ManifestDetailResponse> {
  return apiFetch<ManifestDetailResponse>(`/manifest/flights/${flightId}`, {
    method: "PATCH",
    body: JSON.stringify({ planned_fuel_lbs: plannedFuelLbs }),
  });
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

// ---- Waiting mail & freight and the load plan (#75) -------------------------

export type WaitingStatus = "waiting" | "loaded" | "cancelled";

/** Mail or freight on hand at a station, before it is on any flight. Its
 *  weight and pieces are what is still on the ground. */
export interface WaitingLoadRow {
  id: string;
  station_icao: string;
  destination_icao: string;
  mail_class: MailClass | null;
  description: string;
  weight_lbs: string;
  pieces: number;
  shipper: string | null;
  consignee: string | null;
  notes: string | null;
  status: WaitingStatus;
  received_at: string;
}

export interface WaitingRouteTotal {
  station_icao: string;
  destination_icao: string;
  entries: number;
  weight_lbs: string;
  pieces: number;
}

export interface WaitingListResponse {
  items: WaitingLoadRow[];
  routes: WaitingRouteTotal[];
}

export interface WaitingLoadInput {
  station_icao: string;
  destination_icao: string;
  mail_class: MailClass | null;
  description: string | null;
  weight_lbs: string;
  pieces: number;
  shipper: string | null;
  consignee: string | null;
  notes: string | null;
}

export async function listWaiting(
  params: { station?: string; destination?: string; status?: WaitingStatus | "all" } = {},
): Promise<WaitingListResponse> {
  const search = new URLSearchParams();
  if (params.station) search.set("station", params.station);
  if (params.destination) search.set("destination", params.destination);
  if (params.status) search.set("status", params.status);
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<WaitingListResponse>(`/manifest/waiting${qs}`);
}

export async function createWaiting(body: WaitingLoadInput): Promise<WaitingLoadRow> {
  return apiFetch<WaitingLoadRow>("/manifest/waiting", { method: "POST", body: JSON.stringify(body) });
}

export async function cancelWaiting(id: string): Promise<WaitingLoadRow> {
  return apiFetch<WaitingLoadRow>(`/manifest/waiting/${id}/cancel`, { method: "POST" });
}

export interface LoadPlanTake {
  waiting_load_id: string;
  description: string;
  mail_class: MailClass | null;
  weight_lbs: string;
  pieces: number;
  /** The whole entry, of which this is part or all. */
  of_weight_lbs: string;
  of_pieces: number;
}

export type LoadPlanBlock = "locked" | "no_useful_load" | "fuel_unknown" | "nothing_waiting" | "no_room";

export interface LoadPlanResponse {
  flight_id: string;
  origin: string;
  destinations: string[];
  load: ManifestLoad;
  waiting: WaitingLoadRow[];
  suggestion: LoadPlanTake[];
  suggested_lbs: string;
  left_after_lbs: string | null;
  blocked: LoadPlanBlock | null;
}

export async function getLoadPlan(flightId: string): Promise<LoadPlanResponse> {
  return apiFetch<LoadPlanResponse>(`/manifest/flights/${flightId}/load-plan`);
}

export async function applyLoadPlan(
  flightId: string,
  items: { waiting_load_id: string; weight_lbs: string; pieces: number }[],
): Promise<ManifestDetailResponse> {
  return apiFetch<ManifestDetailResponse>(`/manifest/flights/${flightId}/load-plan/apply`, {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}
