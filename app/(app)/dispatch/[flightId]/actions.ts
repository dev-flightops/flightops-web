"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { packetWeatherFor } from "@/lib/api/dispatch-risk";
import { getFlightManifest } from "@/lib/api/manifest";
import {
  cancelFlight,
  moveFlightDay,
  pullBackRelease,
  releaseFlight,
  resolveWeightReturn,
  updateFlight,
  type FlightMoveResult,
  type FlightUpdatePayload,
} from "@/lib/api/ops";
import { passengerSeatsRefusal } from "@/lib/flights/passenger-seats";
import { releaseRefusal, scheduleRefusal } from "@/lib/flights/schedule-refusals";

import { belowMinimumsFromError } from "@/lib/frat/weather-minimums";

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
    // The weather the dispatch packet keeps (#52), as of the release.
    const packet = await packetWeatherFor(flightId);
    await releaseFlight(
      flightId,
      pilotUserId ?? null,
      overridesAcknowledged,
      staleWeatherAcknowledged,
      (notamAckedIcaos ?? []).map((icao) => ({ icao })),
      acknowledgedWarnings ?? [],
      packet,
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
      // #89: an aircraft that is not IFR certified, below the company's
      // dispatch minimums at a stop. Nothing to acknowledge: name where.
      if (err.message.includes("below_weather_minimums")) {
        const reason = belowMinimumsFromError(err.message);
        return {
          ok: false,
          error: `Release blocked — ${
            reason ??
            "the weather is below the company's dispatch minimums for aircraft not IFR certified."
          }`,
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
      const refused = releaseRefusal(err.message);
      if (refused) return { ok: false, error: refused };
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
      const overSeats = passengerSeatsRefusal(err);
      if (overSeats) return { ok: false, error: overSeats };
      const refused = scheduleRefusal(err.message);
      if (refused) return { ok: false, error: refused };
      return { ok: false, error: `Save failed (HTTP ${err.status}).` };
    }
    return { ok: false, error: "Save failed. Please try again." };
  }

  revalidatePath(`/dispatch/${flightId}`);
  revalidatePath("/dispatch");
  return { ok: true };
}

/** Take a release back before departure (#90). */
export async function pullBackReleaseAction(
  flightId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    await pullBackRelease(flightId, reason);
  } catch (err) {
    return { ok: false, error: withdrawError(err) };
  }
  revalidatePath(`/dispatch/${flightId}`);
  revalidatePath("/dispatch");
  return { ok: true };
}

/** Cancel a released flight before departure (#90). */
export async function cancelReleasedFlightAction(
  flightId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    await cancelFlight(flightId, reason);
  } catch (err) {
    return { ok: false, error: withdrawError(err) };
  }
  revalidatePath(`/dispatch/${flightId}`);
  revalidatePath("/dispatch");
  return { ok: true };
}

/** Cancel a flight that hasn't been released (#106): one planned by
 *  mistake, or no longer needed. The reason is optional here; the
 *  flight stays on record as cancelled, nothing is deleted. */
export async function cancelScheduledFlightAction(
  flightId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    await cancelFlight(flightId, reason.trim() || undefined);
  } catch (err) {
    return { ok: false, error: withdrawError(err) };
  }
  revalidatePath(`/dispatch/${flightId}`);
  revalidatePath("/dispatch");
  revalidatePath("/flight-following");
  return { ok: true };
}

/** Move a flight to another day (#174). Not revalidated here: the dialog
 *  shows what moved, then refreshes the page when it closes. */
export async function moveFlightDayAction(
  flightId: string,
  toDate: string,
  reason: string,
): Promise<{ ok: true; moved: FlightMoveResult } | { ok: false; error: string }> {
  try {
    return { ok: true, moved: await moveFlightDay(flightId, toDate, reason || undefined) };
  } catch (err) {
    return { ok: false, error: moveError(err) };
  }
}

function moveError(err: unknown): string {
  if (!(err instanceof ApiError)) return "Couldn't save. Please try again.";
  if (err.status === 401) return "Your session expired — please sign in again.";
  if (err.status === 403) return "Only a dispatcher or an Exec Admin can do this.";
  if (err.message.includes("reason_required")) return "Give the reason, in a few words at least.";
  if (err.message.includes("already_that_day")) return "The flight is already on that day.";
  if (err.message.includes("move_into_the_past")) {
    return "That time has already passed. Pick a later day.";
  }
  if (err.message.includes("move_too_far")) return "That's over a year away. Check the date.";
  if (err.message.includes("flight_already_departed")) {
    return "This flight has departed, so it stays on its day.";
  }
  if (err.message.includes("flight_not_movable_in_status_")) {
    const status = err.message.split("flight_not_movable_in_status_")[1]?.split(/[^a-z_]/)[0] ?? "";
    return `This flight is ${status.replace(/_/g, " ")}, so it stays on its day.`;
  }
  if (err.message.includes("flight_number_conflict")) {
    return "Another flight already uses that flight number at that time.";
  }
  const refused = scheduleRefusal(err.message);
  if (refused) return refused;
  return `Save failed (HTTP ${err.status}).`;
}

/** Dispatch has re-planned a flight its pilot returned over weight (#174). */
export async function markReplannedAction(flightId: string): Promise<ActionResult> {
  try {
    await resolveWeightReturn(flightId);
  } catch (err) {
    if (!(err instanceof ApiError)) return { ok: false, error: "Couldn't save. Please try again." };
    if (err.status === 401) return { ok: false, error: "Your session expired — please sign in again." };
    if (err.status === 403) {
      return { ok: false, error: "Only dispatch, the Chief Pilot, the DO or an Exec Admin can do this." };
    }
    // Someone else got there first: the card is out of date, not wrong.
    if (err.status !== 404) return { ok: false, error: `Save failed (HTTP ${err.status}).` };
  }
  revalidatePath("/dispatch");
  return { ok: true };
}

/** Passengers on a flight's manifest with no booking (#174): cancelling the
 *  flight brings nothing back for them. Empty when there's no manifest. */
export async function flightWalkUpsAction(flightId: string): Promise<string[]> {
  try {
    const manifest = await getFlightManifest(flightId);
    return manifest.pax
      .filter((p) => !p.is_crew && !p.booking_id && p.check_in_status !== "no_show")
      .map((p) => `${p.first_name} ${p.last_name}`.trim());
  } catch {
    return [];
  }
}

function withdrawError(err: unknown): string {
  if (!(err instanceof ApiError)) return "Couldn't save. Please try again.";
  if (err.status === 401) return "Your session expired — please sign in again.";
  if (err.status === 403) return "Only a dispatcher or an Exec Admin can do this.";
  if (err.status === 422 || err.message.includes("reason_required")) {
    return "Give the reason, in a few words at least.";
  }
  if (err.message.includes("flight_already_departed")) {
    return "This flight has departed, so its release can no longer be taken back.";
  }
  if (err.message.includes("flight_not_released") || err.message.includes("not_cancellable")) {
    return "This flight is no longer released. Refresh to see where it stands.";
  }
  return `Save failed (HTTP ${err.status}).`;
}

