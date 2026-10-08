/**
 * The ASAP hub (#59): the Event Review Committee's decision on each ASAP
 * report. Safety-service `/safety/asap`; the Safety Officer, the DO and
 * Exec Admins only, as ASAP reports themselves.
 */

import { apiFetch } from "./client";
import type { UserRef } from "./safety";
import type { SafetyReport } from "./safety-reports";

/** Legacy's ERC decisions, in its order. */
export const ASAP_DECISIONS = ["pending", "accepted", "accepted_ns", "excluded", "withdrawn"] as const;
export type AsapDecision = (typeof ASAP_DECISIONS)[number];

export const ASAP_DECISION_LABELS: Record<AsapDecision, string> = {
  pending: "Pending Review",
  accepted: "Accepted — Sole Source",
  accepted_ns: "Accepted — Non-Sole Source",
  excluded: "Excluded (criminal/intentional)",
  withdrawn: "Withdrawn by Reporter",
};

/** The decision cards' short labels, as legacy's. */
export const ASAP_DECISION_CARD_LABELS: Record<AsapDecision, string> = {
  pending: "Pending",
  accepted: "Accepted (Sole)",
  accepted_ns: "Accepted (Non-Sole)",
  excluded: "Excluded",
  withdrawn: "Withdrawn",
};

/** The library category the hub lists the FAA MOU from. */
export const ASAP_MOU_CATEGORY = "ASAP MOU";

export interface AsapReview {
  /** YYYY-MM-DD: the day the ERC met on it. */
  review_date: string;
  erc_participants: string | null;
  decision: AsapDecision;
  decision_rationale: string | null;
  corrective_action_summary: string | null;
  de_identified: boolean;
  reviewed_by: UserRef | null;
  /** The review date the decision was recorded for; null while pending. */
  closed_date: string | null;
  updated_at: string;
}

export interface AsapHub {
  items: { report: SafetyReport; review: AsapReview | null }[];
  /** Every decision; pending counts the reports nobody has reviewed. */
  counts: Record<AsapDecision, number>;
}

/** Every field, as the form holds it: a blank one clears. */
export interface AsapReviewInput {
  review_date: string | null;
  erc_participants: string | null;
  decision: AsapDecision;
  decision_rationale: string | null;
  corrective_action_summary: string | null;
  de_identified: boolean;
}

export async function getAsapHub(): Promise<AsapHub> {
  return apiFetch<AsapHub>("/safety/asap");
}

export async function saveAsapReview(reportId: string, input: AsapReviewInput): Promise<AsapReview> {
  return apiFetch<AsapReview>(`/safety/asap/reviews/${encodeURIComponent(reportId)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
