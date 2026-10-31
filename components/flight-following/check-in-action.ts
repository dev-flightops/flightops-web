"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { checkInFlight, getDepartureCheck } from "@/lib/api/ops";
import type { DepartureFlag } from "@/lib/api/types";

/**
 * Server action behind the flight board's Mark Departed / Mark Arrived
 * button (M2-G-11b). Calls POST /flights/{id}/check-in (M2-M-19) and
 * maps backend `detail` strings to friendly error copy.
 *
 * Revalidates the Flight Following list view so the row picks up the
 * new ATD/ATA (and, on arrive, the status flip to completed) without
 * a manual refresh.
 */

export type CheckInEvent = "depart" | "arrive";

export type CheckInActionResult =
  | { ok: true }
  | { ok: false; error: string; flags?: DepartureFlag[] };

/** What Mark Departed would flag if the flight left now (#155), for the
 *  dialog. Null when it couldn't be read: the departure still checks. */
export async function departureCheckAction(flightId: string): Promise<DepartureFlag[] | null> {
  try {
    return (await getDepartureCheck(flightId)).flags;
  } catch {
    return null;
  }
}

export async function checkInFlightAction(
  flightId: string,
  event: CheckInEvent,
  /** The departure's flags were shown in the dialog (#155). */
  confirmFlags = false,
): Promise<CheckInActionResult> {
  try {
    await checkInFlight(flightId, {
      event,
      ...(event === "depart" && confirmFlags ? { confirm_flags: true } : {}),
    });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          ok: false,
          error: "Your session expired — please sign in again.",
        };
      }
      const detail = parseDetail(err.message);
      const structured = parseStructured(err.message);
      if (structured?.error === "departure_flags") {
        return {
          ok: false,
          error: "Something changed since the dialog opened. Read the flags again and confirm.",
          flags: structured.flags as DepartureFlag[] | undefined,
        };
      }
      if (structured?.error === "block_too_short") {
        return {
          ok: false,
          error: `An arrival within ${structured.minimum_minutes ?? 5} minutes of the departure can't be right. Check the times.`,
        };
      }
      if (detail === "cannot_arrive_before_departing") {
        return {
          ok: false,
          error: "Mark the flight Departed first, then Arrived.",
        };
      }
      if (detail === "actual_departure_already_recorded") {
        return {
          ok: false,
          error: "This flight is already marked departed.",
        };
      }
      if (detail === "arrival_before_departure") {
        return {
          ok: false,
          error: "Arrival time can't be before departure time.",
        };
      }
      if (detail === "check_in_time_in_future") {
        return {
          ok: false,
          error: "Check-in time can't be more than an hour ahead of now.",
        };
      }
      if (
        typeof detail === "string" &&
        detail.startsWith("flight_not_checkinable_in_status_")
      ) {
        const status = detail.replace(
          "flight_not_checkinable_in_status_",
          "",
        );
        return {
          ok: false,
          error: `Flight is ${status} — only released flights can be checked in.`,
        };
      }
      return {
        ok: false,
        error: `Check-in failed (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return { ok: false, error: "Check-in failed. Try again in a moment." };
  }

  revalidatePath("/flight-following");
  return { ok: true };
}

function parseStructured(message: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(message) as { detail?: unknown };
    return parsed.detail && typeof parsed.detail === "object"
      ? (parsed.detail as Record<string, unknown>)
      : null;
  } catch {
    return null;
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
