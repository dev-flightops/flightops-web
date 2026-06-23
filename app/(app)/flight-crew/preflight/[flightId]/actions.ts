"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  completePreflightStep,
  recordFratAuthorization,
  submitFratAssessment,
} from "@/lib/api/ops";
import type {
  FratAssessmentResponse,
  FratAuthorizeRequest,
  FratSubmitRequest,
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
