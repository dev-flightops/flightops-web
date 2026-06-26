"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { updateFlightLog } from "@/lib/api/ops";
import type { FlightLogUpdateRequest } from "@/lib/api/types";

/**
 * Server-action wrapper for the Spec 4 Tab 4 (Flight Summary) pilot-
 * writable currency counters: night_takeoffs, approach_precision,
 * approach_non_precision, holds, ifr_actual_minutes,
 * ifr_simulated_minutes.
 *
 * Mirrors the Tab 6 / Tab 7 actions — sibling rather than shared so
 * telemetry tells you which tab the save came from.
 */

export type SummaryActionResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function updateSummaryAction(
  logId: string,
  body: FlightLogUpdateRequest,
): Promise<SummaryActionResult> {
  try {
    await updateFlightLog(logId, body);
    revalidatePath(`/flight-crew/elog/${logId}`);
    return { status: "ok" };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "error",
          message: "Your session expired — please sign in again.",
        };
      }
      const detail = parseDetail(err.message);
      if (detail === "flight_log_not_in_draft_status") {
        return {
          status: "error",
          message: "This log is submitted and can't be edited.",
        };
      }
      if (detail === "flight_log_not_found") {
        return {
          status: "error",
          message: "This log no longer exists. Reload the page.",
        };
      }
      if (err.status === 422) {
        // Bounds violations (negatives, over-cap) all surface as 422
        // from the services Pydantic validators.
        return {
          status: "error",
          message: "Out of range — counts must be 0 or higher.",
        };
      }
      return {
        status: "error",
        message: `Couldn't save (HTTP ${err.status}). Try again.`,
      };
    }
    return { status: "error", message: "Couldn't save. Try again." };
  }
}

function parseDetail(message: string): string {
  try {
    const parsed = JSON.parse(message) as { detail?: unknown };
    return typeof parsed.detail === "string" ? parsed.detail : "";
  } catch {
    return "";
  }
}
