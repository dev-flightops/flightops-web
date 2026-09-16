"use server";

import { revalidatePath } from "next/cache";

import { ApiError, SessionExpiredError } from "@/lib/api/client";
import { acknowledgeAlert } from "@/lib/api/ops";

/**
 * Dismissing and restoring alerts, from the server.
 *
 * `apiFetch` begins with `await auth()`, so the bell — a client
 * component in the top bar — cannot call it. These are passed down as
 * props, the same shape the filings and the attestation form use.
 */

export type DismissResult =
  | { status: "ok" }
  | { status: "error"; message: string };

function describe(err: unknown): DismissResult {
  if (err instanceof SessionExpiredError) {
    return {
      status: "error",
      message: "Your session has expired. Sign in again.",
    };
  }
  if (err instanceof ApiError) {
    return { status: "error", message: `Not saved (HTTP ${err.status}).` };
  }
  return { status: "error", message: "Could not reach ops-service." };
}

export async function dismissAlertAction(
  alertKey: string,
  occurrenceAt: string,
): Promise<DismissResult> {
  try {
    await acknowledgeAlert(alertKey, occurrenceAt);
    // The bell is in the layout, so every page shows the count. A
    // dismissal has to invalidate all of them, not just the one the
    // user happened to be on.
    revalidatePath("/", "layout");
    return { status: "ok" };
  } catch (err) {
    return describe(err);
  }
}

// There is deliberately no restoreAlertAction. The home page's Active
// Alerts panel is the unfiltered view, so the bell does not need an
// un-dismiss control and a second one would be a second answer to
// "what is outstanding". ops-service's DELETE /alerts/acknowledge/{key}
// exists and is tested for when a surface needs it.
