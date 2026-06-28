"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { requestCpReview } from "@/lib/api/ops";
import type { CpReviewAction } from "@/lib/api/types";

/**
 * Server action: pilot opens a CP review for an out-of-window
 * reopen / delete. See `cp-review-decide-actions.ts` for the
 * CP-side approve / decline pair (those live in the CP queue page
 * rather than the elog detail page).
 */

export type CpReviewRequestResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function requestCpReviewAction(
  logId: string,
  action: CpReviewAction,
  reason: string,
): Promise<CpReviewRequestResult> {
  const trimmed = reason.trim();
  try {
    await requestCpReview(logId, {
      requested_action: action,
      requested_reason: trimmed === "" ? null : trimmed,
    });
    revalidatePath(`/flight-crew/elog/${logId}`);
    return { status: "ok" };
  } catch (err) {
    return { status: "error", message: mapError(err, action) };
  }
}

function mapError(err: unknown, action: CpReviewAction): string {
  if (!(err instanceof ApiError)) return "Couldn't open the review. Try again.";
  if (err.status === 401) {
    return "Your session expired — please sign in again.";
  }
  if (err.status === 403) {
    return "Only the pilot who created this log can open a CP review.";
  }
  const detail = parseDetail(err.message);
  if (detail === "cp_review_not_needed_within_window") {
    return action === "reopen"
      ? "This log is still within the 90-day window — just reopen it directly."
      : "This log is still within the 90-day window — just delete it directly.";
  }
  if (detail === "cp_review_already_pending") {
    return "A CP review is already pending on this log. Wait for the decision.";
  }
  if (detail === "flight_log_not_submitted") {
    return "Reopen is only for submitted logs.";
  }
  if (err.status === 404) {
    return "This log no longer exists. Reload the page.";
  }
  if (err.status === 422) {
    return "Reason too long — keep it under 2000 characters.";
  }
  return `Couldn't open the review (HTTP ${err.status}). Try again.`;
}

function parseDetail(message: string): string {
  try {
    const parsed = JSON.parse(message) as { detail?: unknown };
    return typeof parsed.detail === "string" ? parsed.detail : "";
  } catch {
    return "";
  }
}
