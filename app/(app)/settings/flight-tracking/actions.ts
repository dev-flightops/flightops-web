"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { updateFlightTrackingConfig } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/**
 * /settings/flight-tracking server action. Mirrors the backend range
 * validators (1-240 min, 5-600 s) so the form catches out-of-range values
 * before they hit auth-service.
 */

const Schema = z.object({
  overdue_threshold_minutes: z
    .string()
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v) && v >= 1 && v <= 240, {
      message: "Overdue threshold must be 1–240 minutes",
    }),
  position_polling_seconds: z
    .string()
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v) && v >= 5 && v <= 600, {
      message: "Polling interval must be 5–600 seconds",
    }),
  simulation_mode_enabled: z
    .union([z.literal("on"), z.literal(""), z.undefined()])
    .transform((v) => v === "on"),
  spider_tracks_aff_email: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  spider_tracks_aff_endpoint: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export type UpdateTrackingState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export async function updateFlightTrackingAction(
  _prev: UpdateTrackingState,
  formData: FormData,
): Promise<UpdateTrackingState> {
  const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "field-errors", errors };
  }

  try {
    await updateFlightTrackingConfig(parsed.data);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "api-error",
          message: "Your session expired — please sign in again.",
        };
      }
      if (err.status === 422) {
        return {
          status: "api-error",
          message:
            "Values outside the allowed range (1–240 min / 5–600 s). Try again.",
        };
      }
      return {
        status: "api-error",
        message: `Couldn't save (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return {
      status: "api-error",
      message: "Couldn't save. Try again in a moment.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/settings/flight-tracking");
  return { status: "saved" };
}
