"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { updateFlightLog } from "@/lib/api/ops";
import type { FlightLogUpdateRequest } from "@/lib/api/types";

/**
 * Server-action wrapper for the Spec 4 Tab 7 (Misc) inputs —
 * today just `mx_discrepancy`, but additional Tab 7 fields land
 * through this same wrapper as they ship.
 *
 * Same shape as `updateVorCheckAction` (Tab 6) — we keep them as
 * sibling actions rather than one shared util so the action name
 * in error logs / telemetry tells you which tab the save came from.
 * The shared work happens at the `updateFlightLog` client layer.
 */

export type MiscActionResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function updateMiscAction(
  logId: string,
  body: FlightLogUpdateRequest,
): Promise<MiscActionResult> {
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
        return {
          status: "error",
          message: "Note too long — keep it under 4000 characters.",
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
