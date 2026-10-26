"use server";

import { revalidatePath } from "next/cache";

import {
  boardPax,
  checkInPax,
  closeBoarding,
  getCheckIn,
  markNoShow,
  openBoarding,
  promoteStandby,
  resetPax,
  type CheckInInput,
  type CheckInView,
  type NoShowReason,
} from "@/lib/api/check-in";
import { ApiError, SessionExpiredError } from "@/lib/api/client";
import { addPax } from "@/lib/api/manifest";
import { passengerSeatsRefusal } from "@/lib/flights/passenger-seats";

import { refusalMessage } from "./messages";

/**
 * The check-in's steps (#103). Each answers with the whole check-in, so
 * the board re-renders from what the server now holds. Called directly
 * from the client components, as the manifest page's are.
 */

export type StepResult =
  | { ok: true; view: CheckInView }
  | {
      ok: false;
      error: string;
      /** Not a refusal: the session ran out or the server couldn't answer.
       *  A step a phone kept stays kept and goes later (#119). */
      retry?: boolean;
    };

async function step(flightId: string, run: () => Promise<CheckInView>): Promise<StepResult> {
  try {
    const view = await run();
    revalidatePath(`/check-in/${flightId}`);
    revalidatePath(`/manifest/${flightId}`);
    return { ok: true, view };
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return { ok: false, error: "Your session expired — please sign in again.", retry: true };
    }
    if (err instanceof ApiError) {
      if (err.status === 403) {
        return { ok: false, error: "Only check-in staff and the flight's crew can do that." };
      }
      return {
        ok: false,
        error: refusalMessage(err.message) ?? `That didn't go through (HTTP ${err.status}). Try again.`,
        retry: err.status >= 500,
      };
    }
    return { ok: false, error: "That didn't go through. Try again.", retry: true };
  }
}

// `at` is when the step was taken, for one a phone kept without signal and
// sends now (#119).

export async function checkInAction(
  flightId: string,
  paxId: string,
  input: CheckInInput,
  at?: string,
) {
  return step(flightId, () => checkInPax(paxId, input, at));
}

export async function promoteAction(flightId: string, paxId: string, at?: string) {
  return step(flightId, () => promoteStandby(paxId, at));
}

export async function noShowAction(
  flightId: string,
  paxId: string,
  reason: NoShowReason,
  notes: string | null,
  at?: string,
) {
  return step(flightId, () => markNoShow(paxId, reason, notes, at));
}

export async function boardAction(flightId: string, paxId: string, at?: string) {
  return step(flightId, () => boardPax(paxId, at));
}

export async function resetAction(flightId: string, paxId: string) {
  return step(flightId, () => resetPax(paxId));
}

export async function openBoardingAction(flightId: string, at?: string) {
  return step(flightId, () => openBoarding(flightId, at));
}

export async function closeBoardingAction(flightId: string) {
  return step(flightId, () => closeBoarding(flightId));
}

/** The check-in as the server holds it, after a phone's kept steps were
 *  sent and one was refused (#119). */
export async function refreshAction(flightId: string): Promise<StepResult> {
  return step(flightId, () => getCheckIn(flightId));
}

/** A walk-up, added at the gate where the company allows them: a
 *  passenger on the manifest, booked, then checked in as anyone is. */
export async function addWalkUpAction(
  flightId: string,
  walkUp: { first_name: string; last_name: string; weight_lbs: number; baggage_lbs: number },
): Promise<StepResult> {
  try {
    await addPax(flightId, {
      first_name: walkUp.first_name,
      last_name: walkUp.last_name,
      weight_lbs: String(walkUp.weight_lbs),
      baggage_lbs: String(walkUp.baggage_lbs),
      seat_number: null,
      ticket_type: "revenue",
      is_crew: false,
      is_unaccompanied_minor: false,
      contact_phone: null,
      contact_email: null,
      notes: "Walk-up at the gate",
    });
  } catch (err) {
    if (err instanceof ApiError) {
      // The aircraft's passenger seats (#107) before a locked manifest:
      // both are 409s.
      const overSeats = passengerSeatsRefusal(err);
      if (overSeats) return { ok: false, error: overSeats };
      if (err.status === 409) {
        return { ok: false, error: "The manifest is locked, so no one can be added." };
      }
      return { ok: false, error: `The walk-up wasn't added (HTTP ${err.status}).` };
    }
    return { ok: false, error: "The walk-up wasn't added. Try again." };
  }
  return step(flightId, () => getCheckIn(flightId));
}
