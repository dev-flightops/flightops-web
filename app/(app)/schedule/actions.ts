"use server";

import { ApiError } from "@/lib/api/client";
import { type FlightBookings, getFlightBookings } from "@/lib/api/reservations";

/** A flight's bookings and seats for the schedule's flight panel (#137). */
export async function flightBookingsAction(
  flightId: string,
): Promise<{ ok: true; data: FlightBookings } | { ok: false; message: string }> {
  try {
    return { ok: true, data: await getFlightBookings(flightId) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return { ok: false, message: "Your role can't see this flight's bookings." };
    }
    return { ok: false, message: "The flight's bookings couldn't be loaded. Try again in a moment." };
  }
}
