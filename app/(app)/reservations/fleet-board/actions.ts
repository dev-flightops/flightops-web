"use server";

import { revalidatePath } from "next/cache";
import { scheduleRefusal } from "@/lib/flights/schedule-refusals";

import { ApiError } from "@/lib/api/client";
import { updateFlight } from "@/lib/api/ops";
import { updateBooking } from "@/lib/api/reservations";
import { passengerSeatsRefusal } from "@/lib/flights/passenger-seats";

export type MoveResult = { ok: true } | { ok: false; error: string };

/** A block dragged onto another aircraft's row (#150). A booking on a
 *  flight moves the whole flight, as legacy's fleet board did ("Reassign
 *  MM1122 to N100PA?"), through ops' own flight edit: scheduled flights
 *  only, an active aircraft, its seats checked, for dispatch roles. Legacy
 *  checked none of that. A booking on no flight just takes the aircraft. */
export async function moveOnBoardAction(input: {
  bookingId: string;
  flightId: string | null;
  flightNumber: string | null;
  toAircraftId: string;
}): Promise<MoveResult> {
  try {
    if (input.flightId) {
      await updateFlight(input.flightId, { aircraft_id: input.toAircraftId });
    } else {
      await updateBooking(input.bookingId, { aircraft_id: input.toAircraftId });
    }
  } catch (err) {
    return { ok: false, error: refusal(err, input) };
  }
  revalidatePath("/reservations/fleet-board");
  return { ok: true };
}

function refusal(err: unknown, input: { flightId: string | null; flightNumber: string | null }): string {
  const flight = input.flightNumber ?? "The flight";
  if (!(err instanceof ApiError)) return "Could not reach the server. Try again in a moment.";
  if (err.status === 401) return "Your session expired. Sign in again, then retry.";
  if (err.status === 403) {
    return input.flightId
      ? "Only dispatch can move a flight to another aircraft."
      : "Only reservations and dispatch can change a booking's aircraft.";
  }
  const seats = passengerSeatsRefusal(err);
  if (seats) return seats;
  if (err.status === 409 && err.message.includes("flight_not_editable_in_status_")) {
    const status = err.message.split("flight_not_editable_in_status_")[1]?.split(/[^a-z_]/)[0] ?? "";
    return status === "released"
      ? `${flight} is released: pull the release back before moving it to another aircraft.`
      : `${flight} is ${status.replace(/_/g, " ")}, so it stays on its aircraft.`;
  }
  if (err.status === 409 && err.message.includes("aircraft_not_active")) return "That aircraft isn't active.";
  const scheduled = scheduleRefusal(err.message);
  if (scheduled) return scheduled;
  if (err.status === 409 && err.message.includes("booking_immutable")) return "A cancelled booking can't be moved.";
  return `That was not saved (HTTP ${err.status}).`;
}
