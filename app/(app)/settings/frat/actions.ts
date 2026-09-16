"use server";

import { revalidatePath } from "next/cache";

import { ApiError, SessionExpiredError } from "@/lib/api/client";
import { setFratThresholds } from "@/lib/api/auth";

/**
 * Saving one operator's FRAT risk bands.
 *
 * The 422 body is passed through rather than replaced with a status
 * code: auth-service's validator names which pair of thresholds is out
 * of order, and "the request was invalid" throws that away.
 */

export type SaveThresholdsState =
  | { status: "saved" }
  | { status: "error"; message: string };

/** Plain arguments rather than (prevState, FormData).
 *
 *  `useActionState` is React 19 and this app is on 18.3.1 — it works
 *  under Next's runtime but is absent in jsdom, so components built on
 *  it get stubbed out of their own tests (see
 *  app/(app)/stations/[id]/page.test.tsx). A directly-callable action
 *  keeps the form's ordering rule and its preview testable, which is
 *  the part worth testing. Same shape as the attest and
 *  records-request forms. */
export async function saveFratThresholdsAction(
  medium: number,
  high: number,
  extreme: number,
  rationale: string,
): Promise<SaveThresholdsState> {
  if (![medium, high, extreme].every(Number.isInteger)) {
    return { status: "error", message: "All three thresholds must be whole numbers." };
  }
  if (!(medium < high && high < extreme)) {
    return {
      status: "error",
      message:
        "Thresholds must increase: medium below high, high below extreme. A band starting at or above the next one can never be reached.",
    };
  }

  try {
    await setFratThresholds({
      medium_entry_score: medium,
      high_entry_score: high,
      extreme_entry_score: extreme,
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
        message: `The thresholds were not saved (HTTP ${err.status}).`,
      };
    }
    return { status: "error", message: "Could not reach auth-service." };
  }
}
