"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  addFlightLogLeg,
  deleteFlightLogLeg,
  updateFlightLogLeg,
} from "@/lib/api/ops";
import type { FlightLogLegUpdateRequest } from "@/lib/api/types";

/**
 * Server-action wrappers for the Spec 4 Tab 2 leg endpoints. apiFetch
 * is server-only, so client components (the Add Leg button, the
 * inline-edit fields, the Delete button) bounce through here.
 *
 * Each action revalidates the parent log path so the next render
 * reflects the mutation without a hard refresh.
 *
 * Returns:
 *   - {status: "ok"} on success — the client can read the legs list
 *     on the next render
 *   - {status: "error", message: string} when the backend rejects
 *     the request. Known backend `detail` strings get friendly
 *     messages; everything else falls through to a generic one
 */

export type LegActionResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function addLegAction(logId: string): Promise<LegActionResult> {
  try {
    await addFlightLogLeg(logId);
    revalidatePath(`/flight-crew/elog/${logId}`);
    return { status: "ok" };
  } catch (err) {
    return errorFrom(err, "Couldn't add the leg.");
  }
}

export async function updateLegAction(
  logId: string,
  legId: string,
  body: FlightLogLegUpdateRequest,
): Promise<LegActionResult> {
  try {
    await updateFlightLogLeg(logId, legId, body);
    revalidatePath(`/flight-crew/elog/${logId}`);
    return { status: "ok" };
  } catch (err) {
    return errorFrom(err, "Couldn't save the leg.");
  }
}

export async function deleteLegAction(
  logId: string,
  legId: string,
): Promise<LegActionResult> {
  try {
    await deleteFlightLogLeg(logId, legId);
    revalidatePath(`/flight-crew/elog/${logId}`);
    return { status: "ok" };
  } catch (err) {
    return errorFrom(err, "Couldn't delete the leg.");
  }
}

function errorFrom(err: unknown, fallback: string): LegActionResult {
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
    if (detail === "leg_not_found" || detail === "flight_log_not_found") {
      return {
        status: "error",
        message: "That leg no longer exists. Reload the page.",
      };
    }
    if (err.status === 422) {
      return {
        status: "error",
        message:
          // Surface a focused message for the only validator the
          // backend has today (night_landings ≤ landings). Generic
          // fallback covers any future Pydantic validation kinds.
          /night_landings/.test(err.message)
            ? "Night landings can't exceed total landings."
            : "Some field values are invalid.",
      };
    }
    return {
      status: "error",
      message: `${fallback} (HTTP ${err.status})`,
    };
  }
  return { status: "error", message: fallback };
}

function parseDetail(message: string): string {
  try {
    const parsed = JSON.parse(message) as { detail?: unknown };
    return typeof parsed.detail === "string" ? parsed.detail : "";
  } catch {
    return "";
  }
}
