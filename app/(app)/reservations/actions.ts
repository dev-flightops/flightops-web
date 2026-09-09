"use server";

import { ApiError, SessionExpiredError } from "@/lib/api/client";
import {
  type FlightSearchResponse,
  searchFlights,
} from "@/lib/api/flight-search";

/**
 * Flight search, run on the server.
 *
 * The New Booking form is a client component and was importing
 * `searchFlights` straight from lib/api/flight-search. That function
 * goes through `apiFetch`, which starts with `await auth()` — a
 * server-only call — and attaches the session's bearer token. In a
 * browser there is no session to read and no token to attach, so every
 * search from that form threw and the page rendered "Couldn't search
 * flights just now" every single time. The search had never returned a
 * result to anybody using it.
 *
 * That is a fair part of why the booking → dispatch flow read as
 * broken in the 8/28 report: you type a route, nothing comes back, and
 * the only way on is the "file it manually" escape hatch.
 *
 * Same call, now on the server where the session lives. The client
 * awaits an action instead of a fetch.
 *
 * Failures come back as a value rather than an exception, so the form
 * can say which kind of wrong it was. "Your session expired" and
 * "reservations is not answering" need different things from the
 * person reading them.
 */
export type FlightSearchActionResult =
  | { status: "ok"; data: FlightSearchResponse }
  | { status: "session_expired"; message: string }
  | { status: "error"; message: string };

export async function searchFlightsAction(params: {
  origin: string;
  destination: string;
  date: string;
  paxCount: number;
  showUnavailable: boolean;
}): Promise<FlightSearchActionResult> {
  try {
    return { status: "ok", data: await searchFlights(params) };
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return {
        status: "session_expired",
        message: "Your session has expired. Sign in again to search.",
      };
    }
    if (err instanceof ApiError) {
      return {
        status: "error",
        message: `Reservations refused the search (HTTP ${err.status}).`,
      };
    }
    return {
      status: "error",
      message: "Could not reach reservations-service.",
    };
  }
}
