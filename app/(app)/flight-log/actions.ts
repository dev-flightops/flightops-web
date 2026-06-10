"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { createFlightLog } from "@/lib/api/ops";

/**
 * Server action behind the M2-G-26b "Start Flight Log" form.
 *
 * Validates the form payload with zod, calls POST /ops/flight-logs
 * (M2-M-21), then redirects to the per-log detail stub. Maps known
 * backend `detail` strings to friendly inline error messages.
 *
 * The redirect target is /flight-log/{id} which is a placeholder
 * page until the M3 7-tab elog detail (legs / W&B / VOR / trends /
 * misc) ships.
 */

const Schema = z.object({
  aircraft_id: z.string().uuid("Pick an aircraft"),
  flight_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  flight_number: z
    .string()
    .trim()
    .max(12, "Max 12 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  flight_type: z.enum([
    "advisory",
    "charter",
    "training",
    "ferry",
    "other",
  ]),
});

export type CreateFlightLogState =
  | { status: "idle" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export async function createFlightLogAction(
  _prev: CreateFlightLogState,
  formData: FormData,
): Promise<CreateFlightLogState> {
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

  let logId: string;
  try {
    const log = await createFlightLog({
      aircraft_id: parsed.data.aircraft_id,
      flight_id: parsed.data.flight_id ?? null,
      flight_number: parsed.data.flight_number ?? null,
      flight_type: parsed.data.flight_type,
    });
    logId = log.id;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "api-error",
          message: "Your session expired — please sign in again.",
        };
      }
      const detail = parseDetail(err.message);
      if (detail === "aircraft_not_active") {
        return {
          status: "api-error",
          message:
            "The selected aircraft is inactive. Reactivate it under Maintenance, then retry.",
        };
      }
      if (detail === "aircraft_not_found") {
        return {
          status: "api-error",
          message: "That aircraft is no longer in your fleet.",
        };
      }
      if (detail === "flight_aircraft_mismatch") {
        return {
          status: "field-errors",
          errors: {
            flight_id:
              "Pick a flight that belongs to the selected aircraft, or leave it blank.",
          },
        };
      }
      if (detail === "flight_not_found") {
        return {
          status: "field-errors",
          errors: { flight_id: "That flight no longer exists." },
        };
      }
      return {
        status: "api-error",
        message: `Couldn't start the log (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return {
      status: "api-error",
      message: "Couldn't start the log. Try again in a moment.",
    };
  }

  redirect(`/flight-log/${logId}`);
}

function parseDetail(message: string): string {
  try {
    const parsed = JSON.parse(message) as { detail?: unknown };
    return typeof parsed.detail === "string" ? parsed.detail : "";
  } catch {
    return "";
  }
}
