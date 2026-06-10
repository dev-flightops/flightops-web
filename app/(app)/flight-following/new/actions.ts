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

export type CreateFlightFormState =
  | { status: "idle" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export async function createFlightAction(
  _prev: CreateFlightFormState,
  formData: FormData,
): Promise<CreateFlightFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = FlightCreateSchema.safeParse(raw);

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "field-errors", errors };
  }

  // datetime-local inputs come in as "YYYY-MM-DDTHH:MM" with no
  // timezone — interpret as UTC to match every other API surface in
  // the app. Future M3 enhancement: pick the tenant's IANA zone.
  const toUtcIso = (s: string) =>
    s.endsWith("Z") ? s : new Date(`${s}Z`).toISOString();

  try {
    await createFlight({
      flight_number: parsed.data.flight_number,
      aircraft_id: parsed.data.aircraft_id,
      origin: parsed.data.origin,
      destination: parsed.data.destination,
      scheduled_departure_at: toUtcIso(parsed.data.scheduled_departure_at),
      scheduled_arrival_at: toUtcIso(parsed.data.scheduled_arrival_at),
      pax_count: parsed.data.pax_count,
      cargo_lbs: parsed.data.cargo_lbs,
      notes: parsed.data.notes ?? null,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "api-error",
          message: "Your session expired — please sign in again.",
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
        };
      }
      if (detail === "flight_number_conflict") {
        return {
          status: "api-error",
          message:
            "Another flight already uses this flight number at the same departure time. Change one to continue.",
        };
      }
      if (detail === "arrival_must_be_after_departure") {
        return {
          status: "field-errors",
          errors: { scheduled_arrival_at: "Arrival must be after departure" },
        };
      }
      return {
        status: "api-error",
        message: `Couldn't open the flight (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return {
      status: "api-error",
      message: "Couldn't open the flight. Try again in a moment.",
    };
  }

  // Success — redirect outside the try/catch (NEXT_REDIRECT throws
  // intentionally and we don't want it caught by the API error handler).
  redirect("/flight-following");
}
