"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  createAircraft,
  retireAircraft,
  updateAircraft,
} from "@/lib/api/ops";

/** /settings/fleet server actions. Follows the /settings/bases action
 *  pattern: discriminated union state, Zod input, revalidate settings +
 *  fleet + fleet-board on success. */

export type FleetActionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

const nullableTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const nullableIntMax = (max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine(
      (v) => {
        if (v === null) return true;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 && n <= max;
      },
      { message: `Must be a number between 0 and ${max.toLocaleString("en-US")}.` },
    )
    .transform((v) => (v === null ? null : Number(v)));

/** Like `nullableIntMax` but with a lower bound too, and a caller-supplied
 *  message — "between 1903 and 2,100" reads as a payload figure rather
 *  than a year. */
const nullableIntRange = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine(
      (v) => {
        if (v === null) return true;
        const n = Number(v);
        return Number.isInteger(n) && n >= min && n <= max;
      },
      { message },
    )
    .transform((v) => (v === null ? null : Number(v)));

const CreateSchema = z.object({
  tail_number: z
    .string()
    .trim()
    .min(1, "Tail number is required")
    .max(12)
    .transform((v) => v.toUpperCase()),
  seats: z
    .string()
    .trim()
    .refine(
      (v) => {
        const n = Number(v);
        return Number.isInteger(n) && n >= 1 && n <= 999;
      },
      { message: "Seats must be a whole number 1-999." },
    )
    .transform((v) => Number(v)),
  model: nullableTrimmed(80),
  max_payload_lbs: nullableIntMax(200_000),
  airframe_type: nullableTrimmed(40),
  base: z
    .string()
    .trim()
    .max(4)
    .transform((v) => (v === "" ? null : v.toUpperCase()))
    .nullable()
    .optional()
    .refine(
      (v) => v === null || v === undefined || v.length >= 3,
      { message: "Base ICAO must be 3-4 characters." },
    ),
  special_notes: nullableTrimmed(200),
  // HALT-2 — airframe identity. Bounds mirror the API's Field() limits
  // and, for year, the ck_aircraft_year_range check in migration 0070,
  // so a typo is a readable field error instead of a 422 round trip.
  make: nullableTrimmed(100),
  serial_number: nullableTrimmed(100),
  year: nullableIntRange(1903, 2100, "Enter a 4-digit year (1903-2100)."),
});

const UpdateSchema = CreateSchema.omit({ tail_number: true }).extend({
  is_active: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
    .transform((v) => v === "on" || v === "true")
    .optional(),
});

function _formatErrors(err: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

function _apiErrorState(err: unknown, verb: string): FleetActionState {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return {
        status: "api-error",
        message: "Your session expired — please sign in again.",
      };
    }
    if (err.status === 403) {
      return {
        status: "api-error",
        message: "You don't have permission — need Exec Admin or Maintenance.",
      };
    }
    if (err.status === 409) {
      return {
        status: "field-errors",
        errors: {
          tail_number: "That tail number is already in this tenant's fleet.",
        },
      };
    }
    return {
      status: "api-error",
      message: `Couldn't ${verb} (HTTP ${err.status}). Try again in a moment.`,
    };
  }
  return {
    status: "api-error",
    message: `Couldn't ${verb}. Try again in a moment.`,
  };
}

function _revalidate(): void {
  revalidatePath("/settings/fleet");
  revalidatePath("/settings");
  revalidatePath("/reservations/fleet-board");
}

export async function createAircraftAction(
  _prev: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  const parsed = CreateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "field-errors", errors: _formatErrors(parsed.error) };
  }
  try {
    await createAircraft(parsed.data);
  } catch (err) {
    return _apiErrorState(err, "add the aircraft");
  }
  _revalidate();
  return { status: "ok" };
}

export async function updateAircraftAction(
  _prev: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  const aircraftId = String(formData.get("aircraft_id") ?? "");
  if (!aircraftId) {
    return {
      status: "api-error",
      message: "Missing aircraft id — refresh and try again.",
    };
  }
  const parsed = UpdateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "field-errors", errors: _formatErrors(parsed.error) };
  }
  try {
    await updateAircraft(aircraftId, parsed.data);
  } catch (err) {
    return _apiErrorState(err, "save the aircraft");
  }
  _revalidate();
  return { status: "ok" };
}

export async function retireAircraftAction(
  _prev: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  const aircraftId = String(formData.get("aircraft_id") ?? "");
  if (!aircraftId) {
    return {
      status: "api-error",
      message: "Missing aircraft id — refresh and try again.",
    };
  }
  try {
    await retireAircraft(aircraftId);
  } catch (err) {
    return _apiErrorState(err, "retire the aircraft");
  }
  _revalidate();
  return { status: "ok" };
}

export async function reactivateAircraftAction(
  _prev: FleetActionState,
  formData: FormData,
): Promise<FleetActionState> {
  const aircraftId = String(formData.get("aircraft_id") ?? "");
  if (!aircraftId) {
    return {
      status: "api-error",
      message: "Missing aircraft id — refresh and try again.",
    };
  }
  try {
    await updateAircraft(aircraftId, { is_active: true });
  } catch (err) {
    return _apiErrorState(err, "reactivate the aircraft");
  }
  _revalidate();
  return { status: "ok" };
}
