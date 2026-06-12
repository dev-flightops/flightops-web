"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { createGseUnit } from "@/lib/api/ground";

/**
 * Add Equipment form action (M2-G-39b).
 *
 * POSTs to `/ground/gse`. The optional `station_id` ties the unit to
 * a known Station; rejected with 404 if it doesn't belong to the
 * tenant. Successful create redirects to the new unit's detail page.
 */

const Schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  equipment_type: z.enum([
    "tug",
    "gpu",
    "deice_truck",
    "belt_loader",
    "fuel_truck",
    "lavatory",
    "air_start",
    "heater",
    "other",
  ]),
  make: z
    .string()
    .trim()
    .max(100)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  model: z
    .string()
    .trim()
    .max(100)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  serial_number: z
    .string()
    .trim()
    .max(100)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  year: z
    .string()
    .optional()
    .transform((v) => (v && v !== "" ? Number(v) : undefined))
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v >= 1900 && v <= 2200),
      { message: "Year must be between 1900 and 2200" },
    ),
  station_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  service_interval_days: z
    .string()
    .optional()
    .transform((v) => (v && v !== "" ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= 1), {
      message: "Service interval must be at least 1 day",
    }),
  hours_total: z
    .string()
    .optional()
    .transform((v) => (v && v !== "" ? Number(v) : 0))
    .refine((v) => Number.isFinite(v) && v >= 0, {
      message: "Hours must be ≥ 0",
    }),
  manufacturer: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: z
    .string()
    .max(2000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type NewEquipmentState =
  | { status: "idle" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export async function createEquipmentAction(
  _prev: NewEquipmentState,
  formData: FormData,
): Promise<NewEquipmentState> {
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

  let unitId: string;
  try {
    const created = await createGseUnit({
      name: parsed.data.name,
      equipment_type: parsed.data.equipment_type,
      make: parsed.data.make ?? null,
      model: parsed.data.model ?? null,
      serial_number: parsed.data.serial_number ?? null,
      year: parsed.data.year ?? null,
      station_id: parsed.data.station_id ?? null,
      service_interval_days: parsed.data.service_interval_days ?? null,
      hours_total: parsed.data.hours_total,
      manufacturer: parsed.data.manufacturer ?? null,
      notes: parsed.data.notes ?? null,
    });
    unitId = created.id;
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
          errors: { station_id: "That station isn't in your fleet anymore." },
        };
      }
      return {
        status: "api-error",
        message: `Couldn't add the unit (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return {
      status: "api-error",
      message: "Couldn't add the unit. Try again in a moment.",
    };
  }

  redirect(`/equipment/${unitId}`);
}
