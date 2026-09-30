"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  releaseFlight,
  updateFlight,
  type FlightUpdatePayload,
} from "@/lib/api/ops";

import {
  extractBlockingSummary,
  extractMissingIcaos,
  extractMissingWarnings,
} from "./release-errors";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function releaseFlightAction(
  flightId: string,
  /** The PIC this packet reviewed. The backend reads the PIC from the
   *  flight's crew roster and refuses when this names someone else. */
  pilotUserId?: string | null,
  /** The packet recorded supervisor overrides. The backend checks the
   *  override records themselves, not this flag. */
  overridesAcknowledged?: boolean,
  /** HALT-2 — dispatcher acknowledged stale / missing route weather. */
  staleWeatherAcknowledged?: boolean,
  /** Routed ICAOs the dispatcher acknowledged NOTAMs for. Converted to
   *  the backend's per-airport shape here; the richer notam_numbers /
   *  notam_count fields land when the NOTAM feed (M2-M-4) ships and the
   *  panel actually has a list to report. */
  notamAckedIcaos?: string[],
  /** `?warns_acked=` — the currency warnings the dispatcher ticked. The
   *  backend refuses the release while any is missing. */
  acknowledgedWarnings?: string[],
): Promise<ActionResult> {
  try {
    await releaseFlight(
      flightId,
      pilotUserId ?? null,
      overridesAcknowledged,
      staleWeatherAcknowledged,
      (notamAckedIcaos ?? []).map((icao) => ({ icao })),
      acknowledgedWarnings ?? [],
    );
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
      // The PIC is read from the crew roster (29 Sep): none, or a
      // different one from the pilot this packet was checking.
      if (err.message.includes("pic_required")) {
        return {
          ok: false,
          error:
            "Release blocked — this flight has no PIC on its crew. Pick one in Flight Details, then release.",
        };
      }
      if (err.message.includes("pic_mismatch")) {
        return {
          ok: false,
          error:
            "Release blocked — the flight's PIC changed since this page loaded, so the checks shown were for someone else. Reload the packet and review it again.",
        };
      }
      // An override the packet counted on is not on record, or was not
      // written by a Chief Pilot, DO or Exec Admin.
      if (err.message.includes("override_missing")) {
        return {
          ok: false,
          error:
            "Release blocked — there is no supervisor override on record for this flight's hard-block items. A Chief Pilot, Director of Operations or Exec Admin has to record it from their own login.",
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
      // The SIC seat, from the flight's crew. No override path: the
      // supervisor override records PIC deviations.
      if (err.message.includes("sic_hard_blocked")) {
        return {
          ok: false,
          error:
            "Release blocked — the SIC has hard-block currency items. Assign a current SIC in the Crew panel, or clear the items on the compliance board.",
        };
      }
      if (err.message.includes("soft_warnings_not_acknowledged")) {
        const missing = extractMissingWarnings(err.message);
        return {
          ok: false,
          error: missing
            ? `Release blocked — acknowledge the currency warnings first: ${missing}.`
            : "Release blocked — every currency warning needs acknowledging first.",
        };
      }
      if (err.message.includes("flight_time_limit_exceeded")) {
        return {
          ok: false,
          error:
            "Release blocked — a pilot on this flight is past a 14 CFR 135.265 flight-time limit.",
        };
      }
      // Audit finding C1 NOTAM gate. Backend sends:
      //   {"error": "notam_ack_required", "missing_icaos": [...]}
      // Reaching this means the route changed after the boxes were
      // ticked, or the UI was bypassed — either way name the stops.
      if (err.message.includes("notam_ack_required")) {
        const missing = extractMissingIcaos(err.message);
        return {
          ok: false,
          error: missing
            ? `Release blocked — NOTAMs not acknowledged for ${missing}. Check the box for each stop and try again.`
            : "Release blocked — every stop needs a NOTAM acknowledgment before release.",
        };
      }
      // HALT-2 stale-weather gate. Backend sends:
      //   {"error": "stale_weather_not_acknowledged", "stations": [...]}
      // Reaching this means the UI gate was bypassed or the weather aged
      // out between page render and release, so name the fix explicitly.
      if (err.message.includes("stale_weather_not_acknowledged")) {
        return {
          ok: false,
          error:
            "Release blocked — the route has stale or missing weather. Review the Weather panel and acknowledge it, then try again.",
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
      if (err.message.includes("flight_has_legs")) {
        return {
          ok: false,
          error: "This flight has several legs; its route and times are set per leg.",
        };
      }
      return { ok: false, error: `Save failed (HTTP ${err.status}).` };
    }
    return { ok: false, error: "Save failed. Please try again." };
  }

  revalidatePath(`/dispatch/${flightId}`);
  revalidatePath("/dispatch");
  return { ok: true };
}
