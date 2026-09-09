"use server";

import { assessDelayRisk, type DelayAssessment } from "@/lib/api/ai";
import { ApiError, SessionExpiredError } from "@/lib/api/client";

/**
 * Assessing one flight's delay risk, from the server.
 *
 * The button lives in a client component and `assessDelayRisk` goes
 * through `apiFetch`, which starts with `await auth()` — server only.
 * `lib/api/client-boundary.test.ts` fails the build for importing it
 * across that line.
 *
 * Failures come back as values so each flight row can say what went
 * wrong on that row, without taking the rest of the list with it.
 */
export type AssessResult =
  | { status: "ok"; data: DelayAssessment }
  | { status: "session_expired"; message: string }
  | { status: "error"; message: string };

export async function assessDelayAction(
  flightId: string,
  timezone: string,
): Promise<AssessResult> {
  try {
    return {
      status: "ok",
      data: await assessDelayRisk(flightId, timezone || undefined),
    };
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return {
        status: "session_expired",
        message: "Your session has expired. Sign in again to assess.",
      };
    }
    if (err instanceof ApiError) {
      if (err.status === 403) {
        return {
          status: "error",
          message:
            "Delay assessment is limited to dispatchers, chief pilots, the " +
            "director of operations and admins.",
        };
      }
      if (err.status === 404) {
        // The flight went between listing the day and pressing the
        // button — cancelled and purged, or a stale tab.
        return {
          status: "error",
          message: "That flight no longer exists. Refresh the day.",
        };
      }
      return {
        status: "error",
        message: `The assessment was refused (HTTP ${err.status}).`,
      };
    }
    return {
      status: "error",
      message: "Could not reach the assessment service.",
    };
  }
}
