"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { createWeatherBriefing } from "@/lib/api/weather";
import { parseIcaos } from "@/lib/weather/icaos";

/**
 * Server action behind the "New Weather Briefing" form (M2-G-27).
 *
 * Validates with zod, parses the free-form ICAO string into a 1-10
 * code list, calls POST /weather/briefings, then redirects to the
 * permalink-able detail page.
 *
 * Optional flight + aircraft refs from the form populate the briefing
 * context — useful when this is opened from the dispatch packet (M3
 * could deep-link with ?flight_id=… to pre-select).
 */

const Schema = z
  .object({
    airports_raw: z.string().min(1, "Enter at least one airport"),
    flight_id: z
      .string()
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    aircraft_id: z
      .string()
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    dispatcher_notes: z
      .string()
      .max(2000)
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .transform((data) => ({
    ...data,
    airports: parseIcaos(data.airports_raw),
  }));

export type NewBriefingState =
  | { status: "idle" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export async function createBriefingAction(
  _prev: NewBriefingState,
  formData: FormData,
): Promise<NewBriefingState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "field-errors", errors };
  }
  if (parsed.data.airports.length === 0) {
    return {
      status: "field-errors",
      errors: { airports_raw: "Enter at least one valid 3–4 letter ICAO." },
    };
  }
  if (parsed.data.airports.length > 10) {
    return {
      status: "field-errors",
      errors: {
        airports_raw: `Maximum 10 airports per briefing (got ${parsed.data.airports.length}).`,
      },
    };
  }

  let briefingId: string;
  try {
    const briefing = await createWeatherBriefing({
      airports: parsed.data.airports,
      flight_id: parsed.data.flight_id ?? null,
      aircraft_id: parsed.data.aircraft_id ?? null,
      dispatcher_notes: parsed.data.dispatcher_notes ?? null,
    });
    briefingId = briefing.id;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "api-error",
          message: "Your session expired — please sign in again.",
        };
      }
      const detail = parseDetail(err.message);
      if (detail === "flight_not_found") {
        return {
          status: "field-errors",
          errors: { flight_id: "That flight no longer exists." },
        };
      }
      if (detail === "aircraft_not_found") {
        return {
          status: "field-errors",
          errors: { aircraft_id: "That aircraft is no longer in your fleet." },
        };
      }
      return {
        status: "api-error",
        message: `Couldn't save the briefing (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return {
      status: "api-error",
      message: "Couldn't save the briefing. Try again in a moment.",
    };
  }

  redirect(`/weather/${briefingId}`);
}

function parseDetail(message: string): string {
  try {
    const parsed = JSON.parse(message) as { detail?: unknown };
    return typeof parsed.detail === "string" ? parsed.detail : "";
  } catch {
    return "";
  }
}
