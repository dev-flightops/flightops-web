"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { SAFETY_REPORT_STATUSES, reviewSafetyReport } from "@/lib/api/safety-reports";

const scale = z.string().regex(/^[1-5]?$/);

const _schema = z.object({
  report_id: z.string().uuid(),
  status: z.enum(SAFETY_REPORT_STATUSES),
  assigned_to_user_id: z.union([z.string().uuid(), z.literal("")]),
  resolution: z.string().trim().max(10000, "Keep the resolution under 10,000 characters."),
  severity: scale,
  likelihood: scale,
});

const FIELDS = ["status", "assigned_to_user_id", "resolution", "severity", "likelihood"] as const;

export interface ReviewState {
  status: "idle" | "ok" | "error";
  message?: string;
  /** What was sent, so a rejected review is shown again as typed. */
  values?: Record<string, string>;
  /** Bumped on every completed review; the form remounts on it. */
  attempt: number;
}

export async function reviewSafetyReportAction(
  prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const values: Record<string, string> = {};
  for (const key of FIELDS) values[key] = String(formData.get(key) ?? "");
  const attempt = prev.attempt + 1;
  const fail = (message: string): ReviewState => ({ status: "error", message, values, attempt });

  const parsed = _schema.safeParse({ ...values, report_id: formData.get("report_id") ?? "" });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the fields and try again.");
  const v = parsed.data;

  try {
    await reviewSafetyReport(v.report_id, {
      status: v.status,
      assigned_to_user_id: v.assigned_to_user_id || null,
      resolution: v.resolution || null,
      severity: v.severity ? Number(v.severity) : null,
      likelihood: v.likelihood ? Number(v.likelihood) : null,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) return fail("Your session expired. Sign in again to save this review.");
      if (err.status === 403) return fail("Only the safety team can review reports.");
      if (err.status === 404) return fail("This report is no longer available to you.");
      if (err.status === 422 && err.message.includes("assignee_must_be_a_reviewer")) {
        return fail(
          "That person can't be assigned this report: it needs someone on the safety team who is still active (for an ASAP report, the Safety Officer, the DO or an Exec Admin).",
        );
      }
      return fail(`The review was not saved (HTTP ${err.status}).`);
    }
    return fail("Could not reach the safety service. Try again in a moment.");
  }

  revalidatePath(`/safety/reports/${v.report_id}`);
  revalidatePath("/safety/reports");
  return { status: "ok", attempt };
}
