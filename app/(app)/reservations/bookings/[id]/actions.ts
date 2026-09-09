"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  assignBookingToFlight,
  cancelBooking,
  completeBooking,
  confirmBooking,
  quoteBooking,
} from "@/lib/api/reservations";

export interface LifecycleState {
  status: "idle" | "error" | "ok";
  message?: string;
}

/**
 * A 409 in words rather than in the wire format.
 *
 * This used to render the raw body — a dispatcher assigning a booking
 * to a completed flight was shown
 * `Backend rejected the transition ({"detail":"flight_not_assignable_in_status_completed"})`,
 * which says what happened only if you already know. Recognised
 * conflicts get a sentence; anything unrecognised keeps the detail,
 * because an opaque message we cannot explain is still better than
 * one we have invented.
 */
const CONFLICT_MESSAGES: Record<string, string> = {
  flight_not_assignable_in_status_completed:
    "That flight has already been completed, so it cannot take a new booking.",
  flight_not_assignable_in_status_cancelled:
    "That flight was cancelled, so it cannot take a booking.",
  booking_cancelled: "This booking is cancelled — reinstate it first.",
  insufficient_seats: "That flight does not have enough seats left.",
};

function conflictMessage(raw: string): string {
  for (const [slug, sentence] of Object.entries(CONFLICT_MESSAGES)) {
    if (raw.includes(slug)) return sentence;
  }
  return `The change was refused (${raw}).`;
}

async function _wrap(
  bookingId: string,
  op: () => Promise<unknown>,
): Promise<LifecycleState> {
  try {
    await op();
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        return { status: "error", message: conflictMessage(err.message) };
      }
      return {
        status: "error",
        message: `Backend returned HTTP ${err.status}.`,
      };
    }
    return {
      status: "error",
      message: "Could not reach reservations-service.",
    };
  }
  revalidatePath(`/reservations/bookings/${bookingId}`);
  revalidatePath("/reservations");
  revalidatePath("/reservations/fleet-board");
  return { status: "ok" };
}

export async function quoteAction(
  _prev: LifecycleState,
  formData: FormData,
): Promise<LifecycleState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  const dollars = Number(formData.get("quoted_total_dollars") ?? 0);
  if (!bookingId) return { status: "error", message: "Missing booking id." };
  if (!Number.isFinite(dollars) || dollars < 0) {
    return { status: "error", message: "Quote must be a non-negative number." };
  }
  return _wrap(bookingId, () =>
    quoteBooking(bookingId, Math.round(dollars * 100)),
  );
}

export async function confirmAction(
  _prev: LifecycleState,
  formData: FormData,
): Promise<LifecycleState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!bookingId) return { status: "error", message: "Missing booking id." };
  return _wrap(bookingId, () => confirmBooking(bookingId));
}

export async function completeAction(
  _prev: LifecycleState,
  formData: FormData,
): Promise<LifecycleState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!bookingId) return { status: "error", message: "Missing booking id." };
  return _wrap(bookingId, () => completeBooking(bookingId));
}

export async function cancelAction(
  _prev: LifecycleState,
  formData: FormData,
): Promise<LifecycleState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!bookingId) return { status: "error", message: "Missing booking id." };
  if (!reason) {
    return {
      status: "error",
      message: "A cancellation reason is required.",
    };
  }
  return _wrap(bookingId, () => cancelBooking(bookingId, reason));
}

/**
 * Put this booking on a flight.
 *
 * The endpoint has existed since M3 with nothing calling it, which is
 * the whole of the 8/28 report: a reservation could be built and then
 * had no route onward, so it sat unserviced and nothing said so.
 */
export async function assignFlightAction(
  bookingId: string,
  flightId: string,
): Promise<LifecycleState> {
  if (!flightId) {
    return { status: "error", message: "Choose a flight first." };
  }
  return _wrap(bookingId, () => assignBookingToFlight(bookingId, flightId));
}
