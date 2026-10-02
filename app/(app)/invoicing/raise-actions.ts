"use server";

import { revalidatePath } from "next/cache";

import { generateCustomerInvoices } from "@/lib/api/customer-invoices";
import { listFlights } from "@/lib/api/ops";

import {
  explainFlightsError,
  explainRaiseError,
  flownFlightOption,
  raisedFrom,
  RECENT_FLOWN_FLIGHTS,
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
 * The most recent flown flights, newest first, for the picker.
 *
 * ops-service lists flights oldest first and has no newest-first order,
 * so this asks for the count first and then for the last page. A flight
 * counts as flown when it is `completed`, which recording its arrival
 * sets; billing-service refuses anything else as not flown.
 */
export async function recentFlownFlightsAction(): Promise<FlownFlightsState> {
  try {
    const head = await listFlights({ status: "completed", limit: 1 });
    const offset = Math.max(0, head.total - RECENT_FLOWN_FLIGHTS);
    const page = await listFlights({
      status: "completed",
      limit: RECENT_FLOWN_FLIGHTS,
      offset,
    });
    return {
      status: "ok",
      flights: [...page.items].reverse().map(flownFlightOption),
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
