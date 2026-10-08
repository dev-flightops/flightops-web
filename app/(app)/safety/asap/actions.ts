"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ASAP_DECISIONS, saveAsapReview } from "@/lib/api/asap";
import { ApiError } from "@/lib/api/client";

const _schema = z.object({
  report_id: z.string().uuid(),
  review_date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Pick the review date."),
  decision: z.enum(ASAP_DECISIONS),
  erc_participants: z.string().trim().max(2000, "Keep the participants under 2,000 characters."),
  decision_rationale: z.string().trim().max(10000, "Keep the rationale under 10,000 characters."),
  corrective_action_summary: z.string().trim().max(10000, "Keep the actions under 10,000 characters."),
  de_identified: z.string().optional(),
});

const FIELDS = [
  "review_date",
  "decision",
  "erc_participants",
  "decision_rationale",
  "corrective_action_summary",
  "de_identified",
] as const;

export interface AsapReviewState {
  status: "idle" | "ok" | "error";
  message?: string;
  /** What was sent, so a refused review is shown again as typed. */
  values?: Record<string, string>;
  /** Bumped on every completed save; the form remounts on it. */
  attempt: number;
}

export async function saveAsapReviewAction(
  prev: AsapReviewState,
  formData: FormData,
): Promise<AsapReviewState> {
  const values: Record<string, string> = {};
  for (const key of FIELDS) values[key] = String(formData.get(key) ?? "");
  const attempt = prev.attempt + 1;
  const fail = (message: string): AsapReviewState => ({ status: "error", message, values, attempt });

  const parsed = _schema.safeParse({ ...values, report_id: formData.get("report_id") ?? "" });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the fields and try again.");
  const v = parsed.data;

  try {
    await saveAsapReview(v.report_id, {
      review_date: v.review_date || null,
      decision: v.decision,
      erc_participants: v.erc_participants || null,
      decision_rationale: v.decision_rationale || null,
      corrective_action_summary: v.corrective_action_summary || null,
      de_identified: v.de_identified === "on",
    });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) return fail("Your session expired. Sign in again to save this review.");
      if (err.status === 403) return fail("Only the Safety Officer, the DO and Exec Admins record ERC reviews.");
      if (err.status === 404) return fail("That ASAP report is no longer available.");
      if (err.status === 409) return fail("Someone saved this review at the same moment. Save it again.");
      return fail(`The review was not saved (HTTP ${err.status}).`);
    }
    return fail("Could not reach the safety service. Try again in a moment.");
  }

  revalidatePath("/safety/asap");
  return { status: "ok", attempt };
}
