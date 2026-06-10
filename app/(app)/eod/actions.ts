"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { cancelFlight } from "@/lib/api/ops";

/**
 * Cancel a list of stale planned flights from the EOD page (M2-G-25).
 *
 * Cancels run serially so the audit log gets one event per row even
 * if mid-list one of them races against another dispatcher releasing.
 * Partial failures are surfaced — the action returns a summary the
 * page can render ("8 cancelled, 2 failed: …") rather than 502'ing.
 */
export type CancelStaleResult = {
  cancelled: number;
  failures: { flightId: string; reason: string }[];
};

export async function cancelStaleFlightsAction(
  flightIds: string[],
): Promise<CancelStaleResult> {
  const failures: CancelStaleResult["failures"] = [];
  let cancelled = 0;

  for (const flightId of flightIds) {
    try {
      await cancelFlight(flightId);
      cancelled++;
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const detail = parseDetail(
        err instanceof Error ? err.message : "",
      );
      // 409 with a known detail = flight already in a terminal state
      // (another dispatcher beat us to it). Anything else is opaque.
      let reason: string;
      if (status === 401) {
        reason = "session expired";
      } else if (detail) {
        reason = detail;
      } else if (status) {
        reason = `HTTP ${status}`;
      } else {
        reason = "unknown error";
      }
      failures.push({ flightId, reason });
    }
  }

  // Force the EOD page to re-fetch on next render so the cancelled
  // flights drop out of the stale list immediately.
  revalidatePath("/eod");
  return { cancelled, failures };
}

function parseDetail(message: string): string {
  try {
    const parsed = JSON.parse(message) as { detail?: unknown };
    return typeof parsed.detail === "string" ? parsed.detail : "";
  } catch {
    return "";
  }
}
