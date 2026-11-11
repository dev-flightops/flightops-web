"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { assignBookingToFlight } from "@/lib/api/reservations";

export type PlaceResult = { ok: true } | { ok: false; message: string };

const Id = z.string().uuid();

/** Put a waiting booking on a flight it was offered (LOG-05): reservations'
 *  assignment, which checks the seats again. */
export async function placeBookingAction(bookingId: string, flightId: string): Promise<PlaceResult> {
  if (!Id.safeParse(bookingId).success || !Id.safeParse(flightId).success) {
    return { ok: false, message: "That booking or flight isn't valid." };
  }
  try {
    await assignBookingToFlight(bookingId, flightId);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 403) return { ok: false, message: "Only dispatch and reservations can place a booking." };
      if (err.status === 409) return { ok: false, message: "It doesn't fit any more: refresh the page." };
    }
    return { ok: false, message: "Couldn't place it. Try again." };
  }
  revalidatePath("/dispatch");
  revalidatePath(`/reservations/bookings/${bookingId}`);
  return { ok: true };
}
