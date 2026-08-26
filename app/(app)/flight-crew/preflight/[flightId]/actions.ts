"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  completePreflightStep,
  openWeightReturn,
  recordFratAuthorization,
  submitFratAssessment,
  submitPilotAcceptance,
} from "@/lib/api/ops";
import type {
  FratAssessmentResponse,
  WeightReturn,
  WeightReturnCreateRequest,
  FratAuthorizeRequest,
  FratSubmitRequest,
  PilotAcceptanceRequest,
  PilotAcceptanceResponse,
} from "@/lib/api/types";

/**
 * Step completion server actions for the 8-step preflight flow
 * (Spec 4 §"8-STEP PREFLIGHT JOB FLOW"). Each step's UI submits
 * through this action so the form button doesn't have to call the
 * server-only `apiFetch` directly.
 *
 * Returns { ok, error } so the client component can roll back its
 * optimistic state on failure. Revalidates the preflight page on
 * success so the next render advances to the next step.
 */

export interface StepResult {
  ok: boolean;
  /** Short message the step UI surfaces on failure. */
  error?: string;
}

export async function completeStepAction(
  flightId: string,
  stepNumber: number,
  payload: Record<string, unknown> = {},
): Promise<StepResult> {
  try {
    await completePreflightStep(flightId, stepNumber, { payload });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return { ok: false, error: "Your session expired — sign in again." };
      }
      if (err.status === 409) {
        // Either "step_already_completed" or "previous_step_not_completed"
        // — both surface as a single user-facing message; the page
        // re-fetches progress on revalidate and renders the right state.
        return {
          ok: false,
          error: "Step state changed — refresh to continue.",
        };
      }
      if (err.status === 400) {
        return { ok: false, error: "Invalid step." };
      }
      if (err.status === 422) {
        // The retired weight-override payload. A stale tab can still be
        // holding the old form; say what happened rather than "invalid".
        return {
          ok: false,
          error:
            "The weight override was removed — refresh, then return the " +
            "flight to dispatch if it's over limits.",
        };
      }
      return { ok: false, error: `Couldn't save (HTTP ${err.status}).` };
    }
    return { ok: false, error: "Couldn't save — try again." };
  }
  revalidatePath(`/flight-crew/preflight/${flightId}`);
  return { ok: true };
}

/**
 * Spec 4 step 4 — FRAT submit / authorize.
 *
 * Submitting the questionnaire writes a `frat_assessments` row server-
 * side and returns the assessment (with server-computed `total_score`
 * + `risk_level`). The Step 4 UI then renders the risk band; HIGH and
 * EXTREME bands surface an authorization sub-form that calls
 * `recordFratAuthorizationAction`.
 *
 * The preflight Step 4 gate clears (i.e. the pilot can complete the
 * preflight_steps row) when the latest assessment is LOW/MEDIUM, or
 * when HIGH has a `dispatch_contact` authorization, or when EXTREME
 * has a `cp_do_authorization` authorization. The Step 4 component
 * computes that locally from the response; it then calls
 * `completeStepAction(flightId, 4, ...)` like the other steps.
 */

export type FratActionResult =
  | { ok: true; assessment: FratAssessmentResponse }
  | { ok: false; error: string };

export async function submitFratAction(
  flightId: string,
  body: FratSubmitRequest,
): Promise<FratActionResult> {
  try {
    const assessment = await submitFratAssessment(flightId, body);
    revalidatePath(`/flight-crew/preflight/${flightId}`);
    return { ok: true, assessment };
  } catch (err) {
    return { ok: false, error: fratErrorToMessage(err) };
  }
}

export async function recordFratAuthorizationAction(
  flightId: string,
  body: FratAuthorizeRequest,
): Promise<FratActionResult> {
  try {
    const assessment = await recordFratAuthorization(flightId, body);
    revalidatePath(`/flight-crew/preflight/${flightId}`);
    return { ok: true, assessment };
  } catch (err) {
    return { ok: false, error: fratErrorToMessage(err) };
  }
}

function fratErrorToMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — sign in again.";
    if (err.status === 400) return "One of the answers is out of range (0–5).";
    if (err.status === 404) return "Submit an assessment first.";
    if (err.status === 409) return "Authorization not required for this risk level.";
    return `Couldn't save (HTTP ${err.status}).`;
  }
  return "Couldn't save — try again.";
}

/**
 * Spec 4 step 6 — submit Accept or Deny.
 *
 * On accept: writes the row + advances to Step 7 (the next-step
 * gate clears once the latest acceptance row has accepted=true).
 *
 * On deny: writes the row with the reason. Spec 4: "Pilot cannot
 * proceed with job flow until issue resolved." We surface this in
 * the Step 6 UI as a red-banner state with the denied_reason — the
 * pilot can re-submit (accept) once dispatch resolves whatever
 * triggered the deny. The preflight Step 6 row is NOT written on
 * a deny; the gate stays open.
 */

export type PilotAcceptanceResult =
  | { ok: true; acceptance: PilotAcceptanceResponse }
  | { ok: false; error: string };

export async function submitPilotAcceptanceAction(
  flightId: string,
  body: PilotAcceptanceRequest,
): Promise<PilotAcceptanceResult> {
  try {
    const acceptance = await submitPilotAcceptance(flightId, body);
    revalidatePath(`/flight-crew/preflight/${flightId}`);
    return { ok: true, acceptance };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return { ok: false, error: "Your session expired — sign in again." };
      }
      if (err.status === 422) {
        return {
          ok: false,
          error: body.accepted
            ? "Couldn't accept — clear the deny-reason field and try again."
            : "Deny reason must be at least 20 characters.",
        };
      }
      if (err.status === 404) {
        return { ok: false, error: "Flight not found." };
      }
      return { ok: false, error: `Couldn't save (HTTP ${err.status}).` };
    }
    return { ok: false, error: "Couldn't save — try again." };
  }
}

/** Pull the human half out of "weight_return_held_by_another_pilot: Pat
 *  Pilot already returned this flight at 1400 lbs". Falls back to a
 *  generic line if the body isn't the shape we expect — an error path is
 *  the wrong place to throw a second error. */
function _holderMessage(raw: string): string {
  const marker = "weight_return_held_by_another_pilot:";
  const at = raw.indexOf(marker);
  if (at === -1) return "Another pilot already returned this flight.";
  const tail = raw.slice(at + marker.length).replace(/"\}?\s*$/, "").trim();
  return tail.length > 0
    ? tail.charAt(0).toUpperCase() + tail.slice(1)
    : "Another pilot already returned this flight.";
}

export type WeightReturnActionResult =
  | { ok: true; weightReturn: WeightReturn }
  | { ok: false; error: string };

/**
 * Preflight step 2 — hand an over-weight flight back to dispatch.
 *
 * This is what replaced the supervisor override. There is no path here
 * that lets an over-weight flight continue; the pilot states the payload
 * they can accept and dispatch re-plans. The step-2 gate that blocks
 * completion while the return is open lives server-side as well, so this
 * action failing does not leave a way around it.
 */
export async function returnFlightOverWeightAction(
  flightId: string,
  body: WeightReturnCreateRequest,
): Promise<WeightReturnActionResult> {
  try {
    const weightReturn = await openWeightReturn(flightId, body);
    revalidatePath(`/flight-crew/preflight/${flightId}`);
    return { ok: true, weightReturn };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return { ok: false, error: "Your session expired — sign in again." };
      }
      if (err.status === 409) {
        // Another pilot already returned this flight. The backend puts
        // their name and figure after the error code, which is the useful
        // part on a ramp — surface it rather than a generic message.
        return { ok: false, error: _holderMessage(err.message) };
      }
      if (err.status === 422) {
        return { ok: false, error: "Enter a payload figure above zero." };
      }
      return { ok: false, error: `Couldn't send (HTTP ${err.status}).` };
    }
    return { ok: false, error: "Couldn't send — try again." };
  }
}
