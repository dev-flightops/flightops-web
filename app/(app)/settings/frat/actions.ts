"use server";

import { revalidatePath } from "next/cache";

import { ApiError, SessionExpiredError } from "@/lib/api/client";
import { setFratThresholds } from "@/lib/api/auth";

/**
 * Saving one operator's FRAT policy.
 *
 * The 422 body is passed through rather than replaced with a status
 * code: auth-service's validators name which pair of numbers is wrong,
 * and "the request was invalid" throws that away.
 */

export type SaveThresholdsState =
  | { status: "saved" }
  | { status: "error"; message: string };

/**
 * One object rather than positional arguments.
 *
 * This took (medium, high, extreme, rationale) while there were three
 * numbers. The operator's 22 September answers added five company
 * operating limits to the same policy, and eight positional numbers is
 * a call nobody can read or get right at the call site.
 *
 * Still plain arguments rather than (prevState, FormData):
 * `useActionState` is React 19 and this app is on 18.3.1 — it works
 * under Next's runtime but is absent in jsdom, so components built on
 * it get stubbed out of their own tests. A directly-callable action
 * keeps the form's rules and its preview testable, which is the part
 * worth testing.
 */
export interface FratPolicyInput {
  medium: number;
  high: number;
  extreme: number;
  /** Company crosswind limits, by engine count — not the AFM
   *  demonstrated figure. "demonstrated does not limit us." */
  crosswindSingleKt: number;
  crosswindMultiKt: number;
  /** "Within 10 knots of a limit is near." */
  nearMarginKt: number;
  /** "Anything vfr under 1000 ft or 3 miles should be elevated risk." */
  vfrMinCeilingFt: number;
  vfrMinVisibilitySm: number;
  /** "4 hours or any condition that increases risk." Zero turns blocks
   *  off, which is a policy rather than a missing value. */
  blockValidityHours: number;
  rationale: string;
}

export async function saveFratThresholdsAction(
  input: FratPolicyInput,
): Promise<SaveThresholdsState> {
  const {
    medium,
    high,
    extreme,
    crosswindSingleKt,
    crosswindMultiKt,
    nearMarginKt,
    blockValidityHours,
    vfrMinCeilingFt,
    vfrMinVisibilitySm,
    rationale,
  } = input;

  if (![medium, high, extreme].every(Number.isInteger)) {
    return {
      status: "error",
      message: "All three thresholds must be whole numbers.",
    };
  }
  if (!(medium < high && high < extreme)) {
    return {
      status: "error",
      message:
        "Thresholds must increase: medium below high, high below extreme. A band starting at or above the next one can never be reached.",
    };
  }

  if (
    ![crosswindSingleKt, crosswindMultiKt, nearMarginKt, vfrMinCeilingFt].every(
      Number.isInteger,
    )
  ) {
    return {
      status: "error",
      message:
        "Crosswind limits, the near-limit margin and the ceiling must be whole numbers.",
    };
  }
  if (
    crosswindSingleKt < 1 ||
    crosswindSingleKt > 60 ||
    crosswindMultiKt < 1 ||
    crosswindMultiKt > 60
  ) {
    return {
      status: "error",
      message: "Crosswind limits have to be between 1 and 60 knots.",
    };
  }
  // The margin is subtracted from the limit to find where "near"
  // begins, so a margin at or above the limit puts that boundary at
  // zero and every wind — calm included — scores as near the limit.
  // Checked against the tighter limit, since one margin serves both.
  const tighterLimit = Math.min(crosswindSingleKt, crosswindMultiKt);
  if (nearMarginKt < 0 || nearMarginKt >= tighterLimit) {
    return {
      status: "error",
      message: `The near-limit margin has to be smaller than the lower crosswind limit. ${nearMarginKt} kt against a limit of ${tighterLimit} kt would make every wind — including calm — count as near the limit.`,
    };
  }
  if (vfrMinCeilingFt < 0 || vfrMinCeilingFt > 10000) {
    return {
      status: "error",
      message: "The VFR ceiling floor has to be between 0 and 10,000 feet.",
    };
  }
  if (
    !Number.isFinite(vfrMinVisibilitySm) ||
    vfrMinVisibilitySm < 0 ||
    vfrMinVisibilitySm > 10
  ) {
    return {
      status: "error",
      message: "The VFR visibility floor has to be between 0 and 10 miles.",
    };
  }

  if (
    !Number.isInteger(blockValidityHours) ||
    blockValidityHours < 0 ||
    blockValidityHours > 24
  ) {
    return {
      status: "error",
      // 24 is the ceiling because a FRAT carried across more than a
      // day is not an assessment of the flight any more.
      message:
        "Block validity has to be a whole number of hours between 0 and 24. " +
        "Use 0 to turn blocks off.",
    };
  }

  try {
    await setFratThresholds({
      medium_entry_score: medium,
      high_entry_score: high,
      extreme_entry_score: extreme,
      crosswind_single_engine_kt: crosswindSingleKt,
      crosswind_multi_engine_kt: crosswindMultiKt,
      crosswind_near_margin_kt: nearMarginKt,
      vfr_min_ceiling_ft: vfrMinCeilingFt,
      vfr_min_visibility_sm: vfrMinVisibilitySm,
      block_validity_hours: blockValidityHours,
      rationale: rationale.trim() || null,
    });
    revalidatePath("/settings/frat");
    return { status: "saved" };
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return {
        status: "error",
        message: "Your session has expired. Sign in again to save.",
      };
    }
    if (err instanceof ApiError) {
      return {
        status: "error",
        message: `The FRAT policy was not saved (HTTP ${err.status}).`,
      };
    }
    return { status: "error", message: "Could not reach auth-service." };
  }
}
