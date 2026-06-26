"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { deleteFlightLog, reopenFlightLog } from "@/lib/api/ops";

/**
 * Server-action wrappers for the M2-M-10 lifecycle endpoints —
 * `reopen` (submitted → draft within 90 days) and `delete` (soft
 * delete, drafts always / submitted within 90 days).
 *
 * Reopen revalidates the detail page so the header swaps SUBMITTED
 * → DRAFT in place. Delete redirects back to the elog index since
 * the detail page is now 404 for the deleted id.
 *
 * Error mapping mirrors the sibling tab actions: 401 → session
 * expired, 403 → permission, 409 → window/state explainer.
 */

export type LifecycleActionResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function reopenFlightLogAction(
  logId: string,
  reason: string | null,
): Promise<LifecycleActionResult> {
  try {
    await reopenFlightLog(logId, { reason });
    revalidatePath(`/flight-crew/elog/${logId}`);
    return { status: "ok" };
  } catch (err) {
    return { status: "error", message: mapError(err, "reopen") };
  }
}

export async function deleteFlightLogAction(
  logId: string,
  reason: string | null,
): Promise<LifecycleActionResult> {
  try {
    await deleteFlightLog(logId, { reason });
  } catch (err) {
    return { status: "error", message: mapError(err, "delete") };
  }
  // On success the row is gone from list / get-one; bounce back to
  // the index so the user lands somewhere coherent. revalidate first
  // so the index re-fetches without the deleted row.
  revalidatePath("/flight-crew/elog");
  redirect("/flight-crew/elog");
}

function mapError(err: unknown, op: "reopen" | "delete"): string {
  if (!(err instanceof ApiError)) return "Couldn't save. Try again.";
  if (err.status === 401) {
    return "Your session expired — please sign in again.";
  }
  const detail = parseDetail(err.message);
  if (err.status === 403) {
    return op === "reopen"
      ? "Only the pilot who created this log can reopen it."
      : "Only the pilot who created this log can delete it.";
  }
  if (detail === "flight_log_not_submitted") {
    return "This log isn't submitted — nothing to reopen.";
  }
  if (detail === "reopen_window_expired") {
    return "This log is more than 90 days old. Ask a chief pilot to reopen it.";
  }
  if (detail === "delete_window_expired") {
    return "This log is more than 90 days old. Ask a chief pilot to delete it.";
  }
  if (detail === "flight_log_not_found") {
    return "This log no longer exists. Reload the page.";
  }
  if (err.status === 422) {
    return "Reason too long — keep it under 2000 characters.";
  }
  return `Couldn't ${op} (HTTP ${err.status}). Try again.`;
}

function parseDetail(message: string): string {
  try {
    const parsed = JSON.parse(message) as { detail?: unknown };
    return typeof parsed.detail === "string" ? parsed.detail : "";
  } catch {
    return "";
  }
}
