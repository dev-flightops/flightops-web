"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { approveCpReview, declineCpReview } from "@/lib/api/ops";

/**
 * Server actions for the CP-side decide buttons. Both revalidate
 * the queue page so the row disappears (approve / decline both
 * move the review out of `pending`).
 */

export type CpReviewDecisionResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function approveCpReviewAction(
  reviewId: string,
  reviewerNote: string,
): Promise<CpReviewDecisionResult> {
  const trimmed = reviewerNote.trim();
  try {
    await approveCpReview(reviewId, {
      reviewer_note: trimmed === "" ? null : trimmed,
    });
  } catch (err) {
    return { status: "error", message: mapError(err, "approve") };
  }
  revalidatePath("/flight-crew/elog/cp-reviews");
  return { status: "ok" };
}

export async function declineCpReviewAction(
  reviewId: string,
  reviewerNote: string,
): Promise<CpReviewDecisionResult> {
  const trimmed = reviewerNote.trim();
  try {
    await declineCpReview(reviewId, {
      reviewer_note: trimmed === "" ? null : trimmed,
    });
  } catch (err) {
    return { status: "error", message: mapError(err, "decline") };
  }
  revalidatePath("/flight-crew/elog/cp-reviews");
  return { status: "ok" };
}

function mapError(err: unknown, op: "approve" | "decline"): string {
  if (!(err instanceof ApiError)) return "Couldn't save. Try again.";
  if (err.status === 401) {
    return "Your session expired — please sign in again.";
  }
  if (err.status === 403) {
    return "Only chief pilots can decide these reviews.";
  }
  if (err.status === 404) {
    return "Review not found. It may have been resolved already.";
  }
  const detail = parseDetail(err.message);
  if (detail === "cp_review_already_decided") {
    return "Already decided. Refresh the queue.";
  }
  if (detail === "flight_log_already_deleted") {
    return "The flight log was deleted while this request was pending.";
  }
  if (err.status === 422) {
    return "Note too long — keep it under 2000 characters.";
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
