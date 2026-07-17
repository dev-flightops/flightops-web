"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  releaseFlight,
  updateFlight,
  type FlightUpdatePayload,
} from "@/lib/api/ops";

import { extractBlockingSummary } from "./release-errors";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function releaseFlightAction(
  flightId: string,
  /** M2-M-5 — currently-selected PIC from ?pic=<uuid>. Passed to the
   *  backend so the compliance gate runs; omitted callers keep the
   *  legacy behaviour. */
  pilotUserId?: string | null,
  /** M2-G-5 tail — supervisor override recorded already? When true,
   *  release goes through even with hard blocks. */
  overridesAcknowledged?: boolean,
): Promise<ActionResult> {
  try {
    await releaseFlight(flightId, pilotUserId ?? null, overridesAcknowledged);
  } catch (err) {
    if (err instanceof ApiError) {
      // Map well-known backend detail strings to user-friendly messages
      if (err.message.includes("not_releasable_in_status_released")) {
        return { ok: false, error: "This flight has already been released." };
      }
      if (err.message.includes("not_releasable_in_status_cancelled")) {
        return { ok: false, error: "Cancelled flights cannot be released." };
      }
      if (err.message.includes("aircraft_not_active")) {
        return { ok: false, error: "The assigned aircraft is not active." };
      }
      // M2-M-8b airworthiness gate. Backend sends a structured detail:
      //   {"error": "aircraft_not_airworthy", "blocking_issues": [...]}
      if (err.message.includes("aircraft_not_airworthy")) {
        const summary = extractBlockingSummary(err.message);
        return {
          ok: false,
          error: summary
            ? `Release blocked — aircraft is not airworthy: ${summary}. See the Maintenance & Airworthiness panel for full details.`
            : "Release blocked — aircraft is not airworthy. See the Maintenance & Airworthiness panel.",
        };
      }
      // M2-M-5 PIC compliance gate. Backend sends:
      //   {"error": "pic_hard_blocked", "pilot": {...}, "hard_blocks": [...]}
      if (err.message.includes("pic_hard_blocked")) {
        return {
          ok: false,
          error:
            "Release blocked — the assigned PIC has hard-block currency items. Clear them on the compliance board, or record a supervisor override, and try again.",
        };
      }
      if (err.message.includes("pilot_not_found")) {
        return {
          ok: false,
          error:
            "Selected PIC isn't on this tenant's roster. Refresh and pick again.",
        };
      }
      return { ok: false, error: `Release failed (HTTP ${err.status}).` };
    }
    return { ok: false, error: "Release failed. Please try again." };
  }

  revalidatePath(`/dispatch/${flightId}`);
  revalidatePath("/dispatch");
  return { ok: true };
}

export async function updateFlightAction(
  flightId: string,
  patch: FlightUpdatePayload,
): Promise<ActionResult> {
  try {
    await updateFlight(flightId, patch);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.message.includes("not_editable_in_status_")) {
        return {
          ok: false,
          error:
            "This flight is locked and can no longer be edited (it's been released or cancelled).",
        };
      }
      if (err.message.includes("flight_number_conflict")) {
        return {
          ok: false,
          error: "Another flight already uses that flight number at that time.",
        };
      }
      if (err.message.includes("aircraft_not_active")) {
        return { ok: false, error: "The chosen aircraft is not active." };
      }
      if (err.message.includes("aircraft_not_found")) {
        return { ok: false, error: "The chosen aircraft was not found." };
      }
      return { ok: false, error: `Save failed (HTTP ${err.status}).` };
    }
    return { ok: false, error: "Save failed. Please try again." };
  }

  revalidatePath(`/dispatch/${flightId}`);
  revalidatePath("/dispatch");
  return { ok: true };
}
