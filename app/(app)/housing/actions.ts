"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  addHousingRoom,
  createHousingBooking,
  createHousingUnit,
  cancelHousingBooking,
  updateHousingUnit,
  type BookingPurpose,
  type RoomStatus,
  type RoomType,
} from "@/lib/api/housing";

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

/** Server action powering /housing "+ New House" — creates a unit and
 *  revalidates /housing so the list picks it up. `useActionState`
 *  compatible signature. */
export async function createHousingUnitAction(
  _prev: ActionResult<{ id: string }>,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const name = String(formData.get("name") ?? "").trim();
  const station = String(formData.get("station") ?? "").trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (!station) return { ok: false, error: "Station (ICAO) is required." };

  try {
    const unit = await createHousingUnit({
      name,
      station,
      address: strOrNull(formData.get("address")),
      contact_person: strOrNull(formData.get("contact_person")),
      contact_phone: strOrNull(formData.get("contact_phone")),
      color_accent: strOrNull(formData.get("color_accent")),
      notes: strOrNull(formData.get("notes")),
    });
    revalidatePath("/housing");
    return { ok: true, data: { id: unit.id } };
  } catch (err) {
    return { ok: false, error: mapError(err, "Couldn't create unit.") };
  }
}

/** Add a room to an existing unit. Backs the drawer on the unit
 *  detail page. */
export async function addHousingRoomAction(
  unitId: string,
  _prev: ActionResult<{ id: string }>,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const roomNumber = String(formData.get("room_number") ?? "").trim();
  if (!roomNumber) return { ok: false, error: "Room number is required." };

  const capacityRaw = formData.get("capacity");
  const capacity =
    typeof capacityRaw === "string" && capacityRaw.trim()
      ? Number(capacityRaw)
      : 1;
  if (!Number.isFinite(capacity) || capacity < 1) {
    return { ok: false, error: "Capacity must be at least 1." };
  }

  const costRaw = formData.get("cost_per_night");
  const cost =
    typeof costRaw === "string" && costRaw.trim() ? costRaw.trim() : null;

  try {
    const room = await addHousingRoom(unitId, {
      room_number: roomNumber,
      room_type: (formData.get("room_type") as RoomType) ?? "single",
      capacity,
      status: (formData.get("status") as RoomStatus) ?? "available",
      amenities: strOrNull(formData.get("amenities")),
      cost_per_night: cost,
      has_wifi: formData.get("has_wifi") === "on",
      has_kitchen: formData.get("has_kitchen") === "on",
      has_private_bath: formData.get("has_private_bath") === "on",
      has_laundry: formData.get("has_laundry") === "on",
      notes: strOrNull(formData.get("notes")),
    });
    revalidatePath(`/housing/${unitId}`);
    revalidatePath("/housing");
    return { ok: true, data: { id: room.id } };
  } catch (err) {
    return { ok: false, error: mapError(err, "Couldn't add room.") };
  }
}

/** Toggle a unit's active flag. Also revalidates the parent list. */
export async function setHousingUnitActiveAction(
  unitId: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    await updateHousingUnit(unitId, { is_active: isActive });
    revalidatePath("/housing");
    revalidatePath(`/housing/${unitId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err, "Couldn't update unit.") };
  }
}

/** Create a housing booking. Used by the room-row Book button. */
export async function createHousingBookingAction(
  _prev: ActionResult<{ id: string }>,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const roomId = String(formData.get("room_id") ?? "").trim();
  const employeeUserId = String(
    formData.get("employee_user_id") ?? "",
  ).trim();
  const checkIn = String(formData.get("check_in") ?? "").trim();
  if (!roomId) return { ok: false, error: "Room is required." };
  if (!employeeUserId) return { ok: false, error: "Employee is required." };
  if (!checkIn) return { ok: false, error: "Check-in date is required." };

  const checkOut = strOrNull(formData.get("check_out"));
  if (checkOut && checkOut < checkIn) {
    return { ok: false, error: "Check-out must be on or after check-in." };
  }

  try {
    const booking = await createHousingBooking({
      room_id: roomId,
      employee_user_id: employeeUserId,
      check_in: checkIn,
      check_out: checkOut,
      purpose: (formData.get("purpose") as BookingPurpose) || null,
      notes: strOrNull(formData.get("notes")),
    });
    revalidatePath(`/housing`);
    revalidatePath(`/housing/${booking.unit_id ?? ""}`);
    return { ok: true, data: { id: booking.id } };
  } catch (err) {
    return { ok: false, error: mapError(err, "Couldn't create booking.") };
  }
}

/** Cancel a booking. Called from the unit detail bookings list. */
export async function cancelHousingBookingAction(
  bookingId: string,
  unitId: string,
): Promise<ActionResult> {
  try {
    await cancelHousingBooking(bookingId);
    revalidatePath("/housing");
    revalidatePath(`/housing/${unitId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err, "Couldn't cancel booking.") };
  }
}

// ---- helpers ---------------------------------------------------------------

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s === "" ? null : s;
}

function mapError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — sign in again.";
    if (err.status === 403)
      return "You don't have permission to make this change.";
    // Try to surface the backend detail string for 4xx errors so
    // form validation echoes cleanly.
    if (err.status >= 400 && err.status < 500) {
      try {
        const detail = JSON.parse(err.message)?.detail;
        if (typeof detail === "string") return detail;
      } catch {
        // fall through
      }
    }
  }
  return fallback;
}
