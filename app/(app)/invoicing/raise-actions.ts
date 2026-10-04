"use server";

import { revalidatePath } from "next/cache";

import { generateCustomerInvoices } from "@/lib/api/customer-invoices";
import { listFlights } from "@/lib/api/ops";
import { isValidIsoDay } from "@/lib/iso-day";

import {
  explainFlightsError,
  explainRaiseError,
  FLOWN_FLIGHTS_PER_DAY,
  flownFlightOption,
  raisedFrom,
  type FlownFlightsState,
  type RaiseState,
} from "./raise";

/**
 * Raise invoices on /invoicing, from the server.
 *
 * Both go through `apiFetch`, which begins with `await auth()`: server
 * only, so the panel calls these rather than the API client.
 */

/**
 * The flights flown on one day, newest first, for the picker.
 *
 * Picked by day rather than "the most recent fifty", so any flown
 * flight can be raised however old it is. The advice to void a draft
 * and raise the flight again depends on that. The day is the UTC one:
 * ops-service's `on_date` filters on the UTC departure date, and the
 * picker shows each flight's time in Zulu. A flight counts as flown when
 * it is `completed`, which recording its arrival sets; billing-service
 * refuses anything else as not flown.
 */
export async function flownFlightsOnAction(
  onDate: string,
): Promise<FlownFlightsState> {
  if (!isValidIsoDay(onDate)) {
    return { status: "error", message: "Choose the date the flight flew." };
  }
  try {
    const page = await listFlights({
      status: "completed",
      onDate,
      limit: FLOWN_FLIGHTS_PER_DAY,
    });
    return {
      status: "ok",
      // ops-service lists a day oldest first.
      flights: [...page.items].reverse().map(flownFlightOption),
      truncated: page.total > page.items.length,
    };
  } catch (err) {
    return { status: "error", message: explainFlightsError(err) };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Raise the draft invoices for one flown flight. Safe to repeat: a
 *  customer already invoiced for the flight is skipped, with the
 *  invoice named. */
export async function raiseInvoicesAction(flightId: string): Promise<RaiseState> {
  if (!UUID.test(flightId)) {
    return { status: "error", message: "Choose a flown flight." };
  }
  try {
    const result = await generateCustomerInvoices(flightId);
    revalidatePath("/invoicing");
    return raisedFrom(result);
  } catch (err) {
    return { status: "error", message: explainRaiseError(err) };
  }
}
