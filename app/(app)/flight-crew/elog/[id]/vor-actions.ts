"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { updateFlightLog } from "@/lib/api/ops";
import type { FlightLogUpdateRequest } from "@/lib/api/types";

/**
 * Server-action wrapper for the Spec 4 Tab 6 VOR check inputs.
 * apiFetch is server-only, so the client VOR card bounces through
 * here. Each call revalidates the parent elog path so the next
 * render reflects the mutation without a hard refresh.
 *
 * Same error-mapping shape as the leg actions (Tab 2/3/5) — known
 * backend `detail` strings get friendly messages; everything else
 * falls through to a generic one.
 */

export type VorActionResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function updateVorCheckAction(
  logId: string,
  body: FlightLogUpdateRequest,
): Promise<VorActionResult> {
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
          message: "Some field values are invalid.",
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
