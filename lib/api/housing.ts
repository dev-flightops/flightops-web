/**
 * Typed wrapper for the housing-service endpoints on the ops gateway.
 * Router is mounted at /housing on the gateway (see
 * flightops-services/infra/nginx/dev.conf).
 */

import { apiFetch } from "./client";

export const ROOM_TYPES = [
  "single",
  "double",
  "bunk",
  "supervisor_suite",
  "crew_house",
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOM_STATUSES = [
  "available",
  "occupied",
  "maintenance",
  "offline",
] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const BOOKING_PURPOSES = [
  "crew_rest",
  "training",
  "travel",
  "rotation",
  "maintenance",
  "other",
] as const;
export type BookingPurpose = (typeof BOOKING_PURPOSES)[number];

/** Human-friendly labels for the enum literals so form pickers and
 *  detail rows don't have to build their own. */
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  single: "Single",
  double: "Double",
  bunk: "Bunk",
  supervisor_suite: "Supervisor Suite",
  crew_house: "Crew House",
};

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  maintenance: "Maintenance",
  offline: "Offline",
};

export const BOOKING_PURPOSE_LABELS: Record<BookingPurpose, string> = {
  crew_rest: "Crew Rest",
  training: "Training",
  travel: "Travel",
  rotation: "Rotation",
  maintenance: "Maintenance",
  other: "Other",
};

// ---- Response shapes -------------------------------------------------------

export interface HousingUnit {
  id: string;
  name: string;
  station: string;
  address: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  color_accent: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface HousingRoom {
  id: string;
  unit_id: string;
  room_number: string;
  room_type: RoomType | string;
  capacity: number;
  status: RoomStatus | string;
  amenities: string | null;
  /** Numeric decimals arrive as strings from Pydantic — callers should
   *  parseFloat when doing arithmetic. */
  cost_per_night: string | number | null;
  has_wifi: boolean;
  has_kitchen: boolean;
  has_private_bath: boolean;
  has_laundry: boolean;
  notes: string | null;
}

export interface HousingBooking {
  id: string;
  room_id: string;
  room_number: string | null;
  unit_id: string | null;
  unit_name: string | null;
  employee_user_id: string;
  employee_name: string | null;
  check_in: string; // ISO date
  check_out: string | null;
  purpose: BookingPurpose | string | null;
  is_cancelled: boolean;
  cancelled_at: string | null;
  notes: string | null;
}

export interface HousingUnitListResponse {
  items: HousingUnit[];
}

export interface HousingUnitDetailResponse {
  unit: HousingUnit;
  rooms: HousingRoom[];
}

export interface HousingBookingListResponse {
  items: HousingBooking[];
}

// ---- Request payloads ------------------------------------------------------

export interface HousingUnitCreatePayload {
  name: string;
  station: string;
  address?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  color_accent?: string | null;
  notes?: string | null;
}

export interface HousingUnitUpdatePayload {
  name?: string;
  station?: string;
  address?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  color_accent?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface HousingRoomCreatePayload {
  room_number: string;
  room_type?: RoomType;
  capacity?: number;
  status?: RoomStatus;
  amenities?: string | null;
  cost_per_night?: string | number | null;
  has_wifi?: boolean;
  has_kitchen?: boolean;
  has_private_bath?: boolean;
  has_laundry?: boolean;
  notes?: string | null;
}

export interface HousingBookingCreatePayload {
  room_id: string;
  employee_user_id: string;
  check_in: string;
  check_out?: string | null;
  purpose?: BookingPurpose | null;
  notes?: string | null;
}

// ---- Calls -----------------------------------------------------------------

export async function listHousingUnits(
  params: { includeInactive?: boolean } = {},
): Promise<HousingUnitListResponse> {
  const qs = params.includeInactive ? "?include_inactive=true" : "";
  return apiFetch<HousingUnitListResponse>(`/housing/units${qs}`);
}

export async function getHousingUnit(
  unitId: string,
): Promise<HousingUnitDetailResponse> {
  return apiFetch<HousingUnitDetailResponse>(`/housing/units/${unitId}`);
}

export async function createHousingUnit(
  payload: HousingUnitCreatePayload,
): Promise<HousingUnit> {
  return apiFetch<HousingUnit>("/housing/units", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateHousingUnit(
  unitId: string,
  patch: HousingUnitUpdatePayload,
): Promise<HousingUnit> {
  return apiFetch<HousingUnit>(`/housing/units/${unitId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deactivateHousingUnit(unitId: string): Promise<void> {
  await apiFetch<void>(`/housing/units/${unitId}`, { method: "DELETE" });
}

export async function addHousingRoom(
  unitId: string,
  payload: HousingRoomCreatePayload,
): Promise<HousingRoom> {
  return apiFetch<HousingRoom>(`/housing/units/${unitId}/rooms`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface ListBookingsParams {
  from?: string; // YYYY-MM-DD
  to?: string;
  roomId?: string;
  employeeId?: string;
  includeCancelled?: boolean;
}

export async function listHousingBookings(
  params: ListBookingsParams = {},
): Promise<HousingBookingListResponse> {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.roomId) qs.set("room_id", params.roomId);
  if (params.employeeId) qs.set("employee_id", params.employeeId);
  if (params.includeCancelled) qs.set("include_cancelled", "true");
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<HousingBookingListResponse>(`/housing/bookings${tail}`);
}

export async function createHousingBooking(
  payload: HousingBookingCreatePayload,
): Promise<HousingBooking> {
  return apiFetch<HousingBooking>("/housing/bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelHousingBooking(
  bookingId: string,
): Promise<HousingBooking> {
  return apiFetch<HousingBooking>(`/housing/bookings/${bookingId}/cancel`, {
    method: "POST",
  });
}
