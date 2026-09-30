"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  amendFuelOrder,
  cancelFuelOrder,
  createFuelOrder,
  type FuelOrderRequester,
} from "@/lib/api/ground";
import { getFlight } from "@/lib/api/ops";
import { neededByInstant } from "@/lib/fuel";

/**
 * Fuel for one flight, from the dispatch packet and the pilot's
 * preflight (client, 27 Sep): order it without leaving the page, and
 * let the pilot see what dispatch ordered and adjust it or order more.
 *
 * The tail, base and date come from the flight, not the caller: the
 * packet and the preflight both have a flight, and an order for it
 * should not be able to name another aircraft.
 */

export type FuelActionResult = { ok: true } | { ok: false; error: string };

function _revalidate(flightId: string) {
  revalidatePath("/dispatch");
  revalidatePath(`/flight-crew/preflight/${flightId}`);
  revalidatePath("/fuel/orders");
}

function _message(err: unknown, verb: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) {
      // A login that orders only as a pilot orders for its own flights
      // (29 Sep); any other refusal is the role.
      if (err.message.includes("pilot_not_on_this_flight")) {
        return `Couldn't ${verb}: you're not on this flight's crew. Dispatch can do it.`;
      }
      return `Couldn't ${verb}: fuel orders are for dispatchers, Ground Ops, the flight's pilots and management.`;
    }
    if (err.status === 404) return `Couldn't ${verb}: that order, supplier or flight isn't available. Refresh and try again.`;
    if (err.status === 409) {
      if (err.message.includes("inactive")) return "That supplier is inactive — pick another.";
      if (err.message.includes("identical")) return "An identical order is already waiting for the supplier.";
      return `Couldn't ${verb}: the order has already been fueled or cancelled.`;
    }
    return `Couldn't ${verb} (HTTP ${err.status}). Try again.`;
  }
  return `Couldn't ${verb}. Try again.`;
}

const Source = z.enum(["dispatch", "pilot"]);
const Gallons = z
  .number({ invalid_type_error: "Enter the gallons." })
  .positive("Enter the gallons.")
  .max(5000, "That is more fuel than the aircraft holds.");

const OrderInput = z.object({
  flightId: z.string().uuid(),
  source: Source,
  supplierId: z.string().uuid(),
  fuelTypeId: z.string().uuid(),
  gallons: Gallons,
  // UTC wall-clock, "HH:MM": the last one before departure (lib/fuel).
  neededBy: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Needed-by is a 24-hour time.")
    .optional()
    .or(z.literal("")),
  instructions: z.string().trim().max(2000).optional(),
});

export async function orderFuelForFlightAction(
  input: z.input<typeof OrderInput>,
): Promise<FuelActionResult> {
  const parsed = OrderInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the order." };
  }
  const { flightId, source, supplierId, fuelTypeId, gallons, neededBy, instructions } =
    parsed.data;
  try {
    const flight = await getFlight(flightId);
    const neededAt = neededBy
      ? neededByInstant(flight.scheduled_departure_at, neededBy)
      : null;
    // The day the fuel is wanted, which is the day before departure's
    // UTC date when the needed-by time is later in the day than it.
    const date = neededAt
      ? neededAt.toISOString().slice(0, 10)
      : flight.scheduled_departure_at.slice(0, 10);
    await createFuelOrder({
      n_number: flight.aircraft.tail_number,
      base_code: flight.origin,
      supplier_id: supplierId,
      fuel_type_id: fuelTypeId,
      requested_quantity_gallons: gallons,
      requested_fuel_date: date,
      requested_fuel_time: neededAt ? neededAt.toISOString().replace(".000Z", "Z") : null,
      special_instructions: instructions || null,
      flight_id: flightId,
      source: source as FuelOrderRequester,
    });
  } catch (err) {
    return { ok: false, error: _message(err, "place the order") };
  }
  _revalidate(flightId);
  return { ok: true };
}

const AmendInput = z.object({
  flightId: z.string().uuid(),
  orderId: z.string().uuid(),
  source: Source,
  gallons: Gallons,
  note: z.string().trim().max(500).optional(),
});

export async function amendFuelOrderAction(
  input: z.input<typeof AmendInput>,
): Promise<FuelActionResult> {
  const parsed = AmendInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the amount." };
  }
  const { flightId, orderId, source, gallons, note } = parsed.data;
  try {
    await amendFuelOrder(orderId, {
      requested_quantity_gallons: gallons,
      note: note || null,
      source,
    });
  } catch (err) {
    return { ok: false, error: _message(err, "change the order") };
  }
  _revalidate(flightId);
  return { ok: true };
}

const CancelInput = z.object({
  flightId: z.string().uuid(),
  orderId: z.string().uuid(),
  source: Source,
  reason: z.string().trim().min(1, "Say why it is cancelled.").max(2000),
});

export async function cancelFuelOrderAction(
  input: z.input<typeof CancelInput>,
): Promise<FuelActionResult> {
  const parsed = CancelInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Say why it is cancelled." };
  }
  const { flightId, orderId, source, reason } = parsed.data;
  try {
    await cancelFuelOrder(orderId, reason, source);
  } catch (err) {
    return { ok: false, error: _message(err, "cancel the order") };
  }
  _revalidate(flightId);
  return { ok: true };
}
