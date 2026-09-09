"use server";

import { analyseSafety, type SafetyIntelligence } from "@/lib/api/ai";
import { ApiError, SessionExpiredError } from "@/lib/api/client";

/**
 * Running the safety analysis, from the server.
 *
 * The button that starts it is a client component, and `analyseSafety`
 * goes through `apiFetch` — which begins with `await auth()` to attach
 * the session's bearer token and only works on the server. Importing
 * it into the button directly would throw on every click and render as
 * a flaky backend; `lib/api/client-boundary.test.ts` fails the build
 * for exactly that mistake.
 *
 * Failures come back as values rather than exceptions so the page can
 * say which kind of wrong it was. The three are genuinely different
 * things to the person reading them: sign in again, the analysis was
 * refused, or nothing answered.
 */
export type AnalyseResult =
  | { status: "ok"; data: SafetyIntelligence }
  | { status: "session_expired"; message: string }
  | { status: "error"; message: string };

export async function runSafetyAnalysisAction(
  timezone: string,
): Promise<AnalyseResult> {
  try {
    return { status: "ok", data: await analyseSafety(timezone || undefined) };
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return {
        status: "session_expired",
        message: "Your session has expired. Sign in again to run the analysis.",
      };
    }
    if (err instanceof ApiError) {
      // 403 is the one worth naming: the analysis is gated to the
      // people who act on safety findings, and "forbidden" alone
      // leaves the reader wondering whether it is broken.
      if (err.status === 403) {
        return {
          status: "error",
          message:
            "Safety Intelligence is limited to safety officers, chief pilots, " +
            "the director of operations and admins.",
        };
      }
      return {
        status: "error",
        message: `The analysis was refused (HTTP ${err.status}).`,
      };
    }
    return {
      status: "error",
      message:
        "Could not reach the analysis service. It can take a minute on a " +
        "large window — if this was a timeout, try again.",
    };
  }
}
