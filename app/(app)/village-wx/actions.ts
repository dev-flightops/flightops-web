"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createVillageAirport,
  createVillageWeatherReport,
} from "@/lib/api/weather";
import { ApiError } from "@/lib/api/client";

/**
 * /village-wx server actions — file a fresh weather observation and add
 * a new village airport. Both are admin-flavored writes: ramp staff /
 * dispatch fill the form, the action validates with zod, calls the
 * weather-service endpoint, and revalidatePath()s so the board picks up
 * the new row on the next render.
 */

const CLOUD_COVERS = [
  "SKC",
  "CLR",
  "FEW",
  "SCT",
  "BKN",
  "OVC",
  "VV",
] as const;

const optionalNumber = (opts: { min: number; max: number }) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .refine(
      (v) =>
        v == null ||
        (Number.isFinite(Number(v)) &&
          Number(v) >= opts.min &&
          Number(v) <= opts.max),
      `Must be ${opts.min}–${opts.max}`,
    )
    .transform((v) => (v == null ? null : Number(v)));

const ReportSchema = z.object({
  village_airport_id: z.string().uuid("Pick an airport"),
  cloud_cover: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.enum(CLOUD_COVERS).or(z.literal("").transform(() => null)))
    .nullable()
    .optional(),
  ceiling_ft: optionalNumber({ min: 0, max: 50_000 }),
  visibility_sm: optionalNumber({ min: 0, max: 99 }),
  wind_dir_deg: optionalNumber({ min: 0, max: 360 }),
  wind_speed_kt: optionalNumber({ min: 0, max: 200 }),
  wind_gust_kt: optionalNumber({ min: 0, max: 200 }),
  temperature_c: optionalNumber({ min: -90, max: 60 }),
  altimeter_in_hg: optionalNumber({ min: 25, max: 33 }),
  notes: z
    .string()
    .max(2000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export type VillageActionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

function _formatErrors(parsed: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of parsed.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

function _apiErrorState(err: unknown, action: string): VillageActionState {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return {
        status: "api-error",
        message: "Your session expired — please sign in again.",
      };
    }
    if (err.status === 404) {
      return {
        status: "field-errors",
        errors: {
          village_airport_id:
            "That airport isn't in the directory anymore.",
        },
      };
    }
    if (err.status === 409) {
      return {
        status: "field-errors",
        errors: { icao: "That ICAO already exists in this tenant." },
      };
    }
    return {
      status: "api-error",
      message: `Couldn't ${action} (HTTP ${err.status}). Try again in a moment.`,
    };
  }
  return {
    status: "api-error",
    message: `Couldn't ${action}. Try again in a moment.`,
  };
}

export async function fileVillageReportAction(
  _prev: VillageActionState,
  formData: FormData,
): Promise<VillageActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = ReportSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "field-errors", errors: _formatErrors(parsed.error) };
  }
  try {
    await createVillageWeatherReport(parsed.data);
  } catch (err) {
    return _apiErrorState(err, "file the report");
  }
  revalidatePath("/village-wx");
  return { status: "ok" };
}

const AirportSchema = z.object({
  icao: z
    .string()
    .trim()
    .min(2, "ICAO must be 2-10 characters")
    .max(10)
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(1, "Name is required").max(200),
  region: z
    .string()
    .trim()
    .max(100)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(2000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export async function addVillageAirportAction(
  _prev: VillageActionState,
  formData: FormData,
): Promise<VillageActionState> {
  const parsed = AirportSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "field-errors", errors: _formatErrors(parsed.error) };
  }
  try {
    await createVillageAirport(parsed.data);
  } catch (err) {
    return _apiErrorState(err, "add the airport");
  }
  revalidatePath("/village-wx");
  return { status: "ok" };
}
