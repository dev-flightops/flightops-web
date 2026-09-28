"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { createFlight } from "@/lib/api/ops";

/**
 * Server action for the "+ Open Flight" form (M2-G-14).
 *
 * Validates the form payload, calls POST /ops/flights, then redirects
 * to /flight-following on success. Errors come back as a structured
 * object the client can render under the relevant inputs.
 */

const FlightCreateSchema = z
  .object({
    flight_number: z
      .string()
      .trim()
      .min(1, "Flight number is required")
      .max(12, "Max 12 characters"),
    aircraft_id: z.string().uuid("Pick an aircraft"),
    origin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3,4}$/, "3- or 4-letter ICAO code"),
    destination: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3,4}$/, "3- or 4-letter ICAO code"),
    scheduled_departure_at: z
      .string()
      .min(1, "Departure time is required"),
    scheduled_arrival_at: z.string().min(1, "Arrival time is required"),
    pax_count: z.coerce.number().int().min(0).default(0),
    cargo_lbs: z.coerce.number().int().min(0).default(0),
    notes: z.string().max(500).optional().or(z.literal("").transform(() => undefined)),
  })
  .refine(
    (data) =>
      new Date(data.scheduled_arrival_at) >
      new Date(data.scheduled_departure_at),
    {
      message: "Arrival must be after departure",
      path: ["scheduled_arrival_at"],
    },
  );

/** FastAPI 4xx bodies are JSON like {"detail": "aircraft_not_active"}.
 *  apiFetch stuffs the body text into ApiError.message — parse it
 *  back to the string detail. Returns "" on any parse failure so the
 *  caller's switch falls through to the generic fallback. */
function parseDetail(message: string): string {
  try {
    const parsed = JSON.parse(message) as { detail?: unknown };
    return typeof parsed.detail === "string" ? parsed.detail : "";
  } catch {
    return "";
  }
}

/**
 * What the form was submitted with, echoed back on any failure.
 *
 * Client bug report 9/17: "when there's an error on a page or a click
 * happens, all the data drops from whatever you are inputting and you
 * need to reenter it all. It should just give you a notice that a
 * field is wrong."
 *
 * The notice was already there. The data loss was React: these inputs
 * are uncontrolled, and React resets a form's DOM once the action
 * attached to it resolves. With nothing in the returned state to seed
 * `defaultValue` from, every field came back blank — so a dispatcher
 * who mistyped one ICAO retyped the flight number, both airports, both
 * datetimes, pax, cargo and the notes.
 *
 * Echoing the values back is why this exists. The alternative is
 * making nine fields controlled, which is more state to hold for the
 * same result.
 */
export type SubmittedValues = Record<string, string>;

/** One stop after the first leg, as typed: it departs from wherever the
 *  leg before it landed. */
export interface SubmittedStop {
  destination: string;
  departure: string;
  arrival: string;
}

export type CreateFlightFormState =
  | { status: "idle" }
  | {
      status: "field-errors";
      errors: Record<string, string>;
      values: SubmittedValues;
      stops: SubmittedStop[];
    }
  | {
      status: "api-error";
      message: string;
      values: SubmittedValues;
      stops: SubmittedStop[];
    };

/** Legacy's cap: its route checks stopped at ten airports. */
const MAX_LEGS = 9;

function submittedStops(formData: FormData): SubmittedStop[] {
  const all = (key: string) => formData.getAll(key).map((v) => String(v));
  const destinations = all("stop_destination");
  const departures = all("stop_departure");
  const arrivals = all("stop_arrival");
  return destinations.map((destination, i) => ({
    destination: destination.trim().toUpperCase(),
    departure: departures[i] ?? "",
    arrival: arrivals[i] ?? "",
  }));
}

/** Field errors for the stops, keyed stop_<n>_<field>. A stop departs
 *  where the leg before it landed, and not before it lands. */
function stopErrors(
  stops: SubmittedStop[],
  firstArrival: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (stops.length + 1 > MAX_LEGS) {
    errors.stops = `A flight can have at most ${MAX_LEGS} legs.`;
  }
  let previousArrival = firstArrival;
  stops.forEach((stop, i) => {
    if (!/^[A-Z]{3,4}$/.test(stop.destination)) {
      errors[`stop_${i}_destination`] = "3- or 4-letter ICAO code";
    }
    if (!stop.departure) {
      errors[`stop_${i}_departure`] = "Departure time is required";
    } else if (previousArrival && new Date(stop.departure) < new Date(previousArrival)) {
      errors[`stop_${i}_departure`] = "Departs before the leg before it lands";
    }
    if (!stop.arrival) {
      errors[`stop_${i}_arrival`] = "Arrival time is required";
    } else if (stop.departure && new Date(stop.arrival) <= new Date(stop.departure)) {
      errors[`stop_${i}_arrival`] = "Arrival must be after departure";
    }
    previousArrival = stop.arrival;
  });
  return errors;
}

/** Only strings — a File entry in a FormData is not a form value we
 *  can put back into an input's defaultValue. */
function submittedValues(formData: FormData): SubmittedValues {
  const out: SubmittedValues = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) {
      out[key] = value;
    }
  }
  return out;
}

export async function createFlightAction(
  _prev: CreateFlightFormState,
  formData: FormData,
): Promise<CreateFlightFormState> {
  const raw = Object.fromEntries(formData.entries());
  const values = submittedValues(formData);
  const stops = submittedStops(formData);
  const parsed = FlightCreateSchema.safeParse(raw);

  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
  }
  Object.assign(errors, stopErrors(stops, values.scheduled_arrival_at ?? ""));
  if (!parsed.success || Object.keys(errors).length > 0) {
    return { status: "field-errors", errors, values, stops };
  }

  // datetime-local inputs come in as "YYYY-MM-DDTHH:MM" with no
  // timezone — interpret as UTC to match every other API surface in
  // the app. Future M3 enhancement: pick the tenant's IANA zone.
  const toUtcIso = (s: string) =>
    s.endsWith("Z") ? s : new Date(`${s}Z`).toISOString();

  // The client, 27 Sep: "It appears there is not a way to build a multi
  // leg route." Leg 1 is the form's origin and destination; each stop
  // departs where the leg before it landed. The flight's own endpoints
  // are the first departure and the last arrival.
  const firstLeg = {
    origin: parsed.data.origin,
    destination: parsed.data.destination,
    scheduled_departure_at: toUtcIso(parsed.data.scheduled_departure_at),
    scheduled_arrival_at: toUtcIso(parsed.data.scheduled_arrival_at),
  };
  const legs = [firstLeg];
  for (const stop of stops) {
    legs.push({
      origin: legs[legs.length - 1].destination,
      destination: stop.destination,
      scheduled_departure_at: toUtcIso(stop.departure),
      scheduled_arrival_at: toUtcIso(stop.arrival),
    });
  }
  const last = legs[legs.length - 1];

  try {
    await createFlight({
      flight_number: parsed.data.flight_number,
      aircraft_id: parsed.data.aircraft_id,
      origin: firstLeg.origin,
      destination: last.destination,
      scheduled_departure_at: firstLeg.scheduled_departure_at,
      scheduled_arrival_at: last.scheduled_arrival_at,
      pax_count: parsed.data.pax_count,
      cargo_lbs: parsed.data.cargo_lbs,
      notes: parsed.data.notes ?? null,
      ...(legs.length > 1 ? { legs } : {}),
    });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "api-error",
          message: "Your session expired — please sign in again.",
          values,
          stops,
        };
      }
      // FastAPI 4xx bodies are JSON like {"detail": "..."}. apiFetch
      // stuffs the body text into ApiError.message — parse it back.
      const detail = parseDetail(err.message);
      if (detail === "aircraft_not_active") {
        return {
          status: "api-error",
          message:
            "The selected aircraft is inactive. Reactivate it under Maintenance, then retry.",
          values,
          stops,
        };
      }
      if (detail === "flight_number_conflict") {
        return {
          status: "api-error",
          message:
            "Another flight already uses this flight number at the same departure time. Change one to continue.",
          values,
          stops,
        };
      }
      if (detail === "arrival_must_be_after_departure") {
        return {
          status: "field-errors",
          errors: { scheduled_arrival_at: "Arrival must be after departure" },
          values,
          stops,
        };
      }
      if (detail === "legs_out_of_order" || detail === "legs_not_continuous") {
        return {
          status: "api-error",
          message:
            "The legs don't fly in order — each stop has to depart after the leg before it lands.",
          values,
          stops,
        };
      }
      if (detail === "too_many_legs") {
        return {
          status: "api-error",
          message: `A flight can have at most ${MAX_LEGS} legs.`,
          values,
          stops,
        };
      }
      return {
        status: "api-error",
        message: `Couldn't open the flight (HTTP ${err.status}). Try again in a moment.`,
        values,
        stops,
      };
    }
    return {
      status: "api-error",
      message: "Couldn't open the flight. Try again in a moment.",
      values,
      stops,
    };
  }

  // Success — redirect outside the try/catch (NEXT_REDIRECT throws
  // intentionally and we don't want it caught by the API error handler).
  redirect("/flight-following");
}
