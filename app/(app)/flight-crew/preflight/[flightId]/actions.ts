"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { completePreflightStep } from "@/lib/api/ops";

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
