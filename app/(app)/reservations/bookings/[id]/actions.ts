"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  assignBookingToFlight,
  cancelBooking,
  completeBooking,
  confirmBooking,
  quoteBooking,
  type UpdateBookingInput,
  updateBooking,
} from "@/lib/api/reservations";
import { localToUtcIso, zoneFor } from "@/lib/format/local-time";
import { passengersFromForm } from "@/lib/reservations/passenger-form";
import { refusalMessage } from "@/lib/reservations/refusals";

export interface LifecycleState {
  status: "idle" | "error" | "ok";
  message?: string;
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
        return { status: "error", message: refusalMessage(err.message) };
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

export interface EditBookingState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}

const AIRPORT = /^[A-Z0-9]{3,4}$/;

/**
 * Edit a booking (#147): the client, 29 Oct, "Need a way to edit bookings
 * after they are entered." Any stage but cancelled, as legacy; the service
 * keeps each field it changes in the booking's history. Every field is
 * sent, and only what differs is changed and kept.
 */
export async function updateBookingAction(
  _prev: EditBookingState,
  formData: FormData,
): Promise<EditBookingState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!bookingId) return { status: "error", message: "Missing booking id." };
  const fieldErrors: Record<string, string> = {};
  const input: UpdateBookingInput = {};

  // The route and who it's for change on the manifest once its passengers
  // are there; the form doesn't send them then.
  const routeEditable = formData.get("route_editable") === "1";
  const origin = String(formData.get("origin_icao") ?? "").trim().toUpperCase();
  const destination = String(formData.get("destination_icao") ?? "").trim().toUpperCase();
  if (routeEditable) {
    if (!AIRPORT.test(origin)) fieldErrors.origin_icao = "An airport code like PANC or A61.";
    if (!AIRPORT.test(destination)) fieldErrors.destination_icao = "An airport code like PANC or A61.";
    if (origin && origin === destination) fieldErrors.destination_icao = "Destination must differ from origin.";
    input.origin_icao = origin;
    input.destination_icao = destination;
  }

  // Local at the departure base, as the booking was filed (#68).
  const from = routeEditable ? origin : String(formData.get("origin_current") ?? "");
  const local = String(formData.get("requested_departure_at_local") ?? "");
  const departure = local ? localToUtcIso(local, zoneFor(await loadZoneTable(), from)) : null;
  if (!departure) fieldErrors.requested_departure_at_local = "Pick a valid date and time.";
  else input.requested_departure_at = departure;

  if (formData.get("edit_passengers") === "1") {
    const people = passengersFromForm(formData);
    if (typeof people === "string") fieldErrors.passengers = people;
    else if (people.length === 0) fieldErrors.passengers = "Name at least one passenger.";
    else input.passengers = people;
  } else if (formData.has("pax_count")) {
    const pax = Number(formData.get("pax_count"));
    if (!Number.isInteger(pax) || pax < 0 || pax > 999) fieldErrors.pax_count = "Pax count 0-999.";
    else input.pax_count = pax;
  }

  const aircraftId = String(formData.get("aircraft_id") ?? "");
  if (aircraftId) input.aircraft_id = aircraftId;
  input.cargo_notes = String(formData.get("cargo_notes") ?? "");
  input.notes = String(formData.get("notes") ?? "");
  const quote = String(formData.get("quoted_total_dollars") ?? "").trim();
  if (quote) {
    const dollars = Number(quote);
    if (!Number.isFinite(dollars) || dollars < 0) fieldErrors.quoted_total_dollars = "Amount must be 0 or more.";
    else input.quoted_total_cents = Math.round(dollars * 100);
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors };
  }
  try {
    await updateBooking(bookingId, input);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409 || err.status === 404) {
        return { status: "error", message: refusalMessage(err.message) };
      }
      return { status: "error", message: `Backend rejected the change (HTTP ${err.status}).` };
    }
    return { status: "error", message: "Could not reach reservations-service." };
  }
  revalidatePath("/reservations");
  revalidatePath("/reservations/fleet-board");
  redirect(`/reservations/bookings/${bookingId}?updated=1`);
}
