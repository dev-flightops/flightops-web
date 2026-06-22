"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { createStation } from "@/lib/api/ground";

/**
 * Add Station form action (M2-G-38b).
 *
 * POSTs to `/ground/stations` and redirects to the new station's
 * detail page on success. The backend enforces the
 * `(tenant_id, icao_code)` uniqueness constraint; we surface the 409
 * as a `field-errors` shape with the ICAO field highlighted so the
 * dispatcher can pick a different code.
 */

const STATION_TYPES = [
  "hub_base",
  "spoke_base",
  "village_airport",
  "maintenance_base",
  "custom",
] as const;

const FUEL_TYPES = ["Jet A", "100LL"] as const;

const Schema = z.object({
  icao_code: z
    .string()
    .trim()
    .min(2, "ICAO must be 2–10 characters")
    .max(10, "ICAO must be 2–10 characters")
    .regex(/^[A-Za-z0-9]+$/, "ICAO must be alphanumeric only"),
  name: z.string().trim().min(1, "Name is required").max(200),
  city: z
    .string()
    .trim()
    .max(100)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  state: z
    .string()
    .trim()
    .max(100)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  elevation_ft: z
    .string()
    .optional()
    .transform((v) => (v && v !== "" ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= -1000 && v <= 30000), {
      message: "Elevation must be between -1000 and 30000 ft",
    }),
  has_reporting_function: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  // Spec 6 §"Add Station form" fields (migration 0026 / PR #61).
  station_type: z.enum(STATION_TYPES).default("spoke_base"),
  is_hub: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  fuel_available: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  // FormData repeats checkboxes with the same name; we read .getAll() in
  // the action and pass a list straight to the schema.
  fuel_types_available: z
    .array(z.enum(FUEL_TYPES))
    .default([]),
  latitude: z
    .string()
    .optional()
    .transform((v) => (v && v !== "" ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= -90 && v <= 90), {
      message: "Latitude must be between -90 and 90",
    }),
  longitude: z
    .string()
    .optional()
    .transform((v) => (v && v !== "" ? Number(v) : undefined))
    .refine(
      (v) => v === undefined || (Number.isFinite(v) && v >= -180 && v <= 180),
      { message: "Longitude must be between -180 and 180" },
    ),
  notes: z
    .string()
    .max(2000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type NewStationState =
  | { status: "idle" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export async function createStationAction(
  _prev: NewStationState,
  formData: FormData,
): Promise<NewStationState> {
  // FormData.entries() collapses repeated keys to the last value; the
  // fuel-types checkboxes need .getAll() so we can preserve all selections.
  const raw: Record<string, unknown> = Object.fromEntries(formData.entries());
  raw.fuel_types_available = formData.getAll("fuel_types_available");
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "field-errors", errors };
  }

  let stationId: string;
  try {
    const created = await createStation({
      icao_code: parsed.data.icao_code,
      name: parsed.data.name,
      city: parsed.data.city ?? null,
      state: parsed.data.state ?? null,
      elevation_ft: parsed.data.elevation_ft ?? null,
      has_reporting_function: parsed.data.has_reporting_function,
      station_type: parsed.data.station_type,
      is_hub: parsed.data.is_hub,
      fuel_available: parsed.data.fuel_available,
      // Only forward fuel types when the toggle is on — keeps the
      // backend's invariant (an unfueled station has no fuel-type
      // selection) clean even if the user left checkboxes ticked
      // before flipping the toggle off.
      fuel_types_available: parsed.data.fuel_available
        ? parsed.data.fuel_types_available
        : [],
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      notes: parsed.data.notes ?? null,
    });
    stationId = created.id;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "api-error",
          message: "Your session expired — please sign in again.",
        };
      }
      if (err.status === 409) {
        return {
          status: "field-errors",
          errors: {
            icao_code: `ICAO ${parsed.data.icao_code} already exists for this tenant.`,
          },
        };
      }
      return {
        status: "api-error",
        message: `Couldn't add the station (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return {
      status: "api-error",
      message: "Couldn't add the station. Try again in a moment.",
    };
  }

  redirect(`/stations/${stationId}`);
}
