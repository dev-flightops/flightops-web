"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createFuelQualityTest } from "@/lib/api/ground";
import { ApiError } from "@/lib/api/client";

/**
 * /fuel/quality server action — log a fresh quality test. Validates
 * with zod, hits POST /ground/fuel/quality-tests, revalidates the
 * page on success. The backend derives `result` from the water +
 * particulate flags, so the form doesn't ask for it directly.
 */

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

const Schema = z.object({
  base_code: z
    .string()
    .trim()
    .min(2, "Base code is required")
    .max(10)
    .transform((v) => v.toUpperCase()),
  n_number: z
    .string()
    .trim()
    .max(20)
    .transform((v) => (v === "" ? null : v.toUpperCase()))
    .nullable()
    .optional(),
  fuel_type_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  test_kind: z.enum(["sump", "supplier_bulk", "tank_calibration", "other"]),
  water_detected: z
    .union([z.literal("on"), z.literal(""), z.undefined()])
    .transform((v) => v === "on"),
  particulates_detected: z
    .union([z.literal("on"), z.literal(""), z.undefined()])
    .transform((v) => v === "on"),
  sample_volume_oz: optionalNumber({ min: 0, max: 10_000 }),
  ambient_temp_c: optionalNumber({ min: -90, max: 60 }),
  notes: z
    .string()
    .max(2000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export type FuelQualityActionState =
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

export async function createFuelQualityTestAction(
  _prev: FuelQualityActionState,
  formData: FormData,
): Promise<FuelQualityActionState> {
  const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "field-errors", errors: _formatErrors(parsed.error) };
  }
  try {
    await createFuelQualityTest({
      base_code: parsed.data.base_code,
      n_number: parsed.data.n_number,
      fuel_type_id: parsed.data.fuel_type_id,
      test_kind: parsed.data.test_kind,
      water_detected: parsed.data.water_detected,
      particulates_detected: parsed.data.particulates_detected,
      sample_volume_oz: parsed.data.sample_volume_oz,
      ambient_temp_c: parsed.data.ambient_temp_c,
      notes: parsed.data.notes,
    });
  } catch (err) {
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
            fuel_type_id: "That fuel type isn't in the directory anymore.",
          },
        };
      }
      return {
        status: "api-error",
        message: `Couldn't log the test (HTTP ${err.status}). Try again.`,
      };
    }
    return {
      status: "api-error",
      message: "Couldn't log the test. Try again in a moment.",
    };
  }
  revalidatePath("/fuel/quality");
  return { status: "ok" };
}
