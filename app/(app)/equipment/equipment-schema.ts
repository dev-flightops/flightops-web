import { z } from "zod";

/**
 * The equipment form's fields, for Add Equipment and Edit alike (#134: the
 * edit form). A "use server" file may only export its actions, so the schema
 * lives here.
 */

export const EquipmentSchema = z.object({
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
  // Legacy's add form had it; without it a new unit never showed a
  // service due (#134).
  next_service_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .optional()
    .or(z.literal("").transform(() => undefined)),
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

export type EquipmentFormState =
  | { status: "idle" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

/** A blank field is no value: the optional text fields above let "" through. */
export function orNull<T>(value: T | "" | undefined): T | null {
  return value === undefined || value === "" ? null : value;
}

/** The first problem per field, as the form shows them. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
