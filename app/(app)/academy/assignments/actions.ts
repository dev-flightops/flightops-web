"use server";

import { revalidatePath } from "next/cache";

import { enrol, listEnrollments } from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

export interface BulkAssignResult {
  ok: boolean;
  error?: string;
  assigned: number;
  skipped: number;
  /** Names / emails of learners whose enrol call failed for a
   *  reason other than "already enrolled". Rendered inline so the
   *  admin can retry the miss. */
  failures: Array<{ user_id: string; label: string; error: string }>;
}

/**
 * Bulk-assign a course to a set of learners.
 *
 * Pre-fetches existing in-progress enrolments for the course and
 * only fires `enrol()` for learners who don't already have one — so
 * the "assigned N, skipped K" summary is accurate before the calls
 * begin. `enrol()` is itself idempotent (returns the active row on
 * duplicate), so this is belt-and-suspenders correctness.
 */
export async function bulkAssignAction(
  courseId: string,
  userIds: string[],
  userLabels: Record<string, string>,
): Promise<BulkAssignResult> {
  if (!courseId) {
    return {
      ok: false,
      error: "Pick a course.",
      assigned: 0,
      skipped: 0,
      failures: [],
    };
  }
  if (userIds.length === 0) {
    return {
      ok: false,
      error: "Pick at least one learner.",
      assigned: 0,
      skipped: 0,
      failures: [],
    };
  }

  // Existing in-progress enrolments for this course → skip these.
  let alreadyEnrolled = new Set<string>();
  try {
    const resp = await listEnrollments({
      course_id: courseId,
      status: "in_progress",
      limit: 500,
    });
    alreadyEnrolled = new Set(resp.items.map((e) => e.user.id));
  } catch (err) {
    return {
      ok: false,
      error: mapError(err, "Couldn't check existing enrolments."),
      assigned: 0,
      skipped: 0,
      failures: [],
    };
  }

  const toAssign = userIds.filter((id) => !alreadyEnrolled.has(id));
  const skipped = userIds.length - toAssign.length;

  const failures: BulkAssignResult["failures"] = [];
  let assigned = 0;

  // Serial rather than parallel — the caller might select 50+ users,
  // and firing 50 concurrent POSTs strains the auth + academy pods
  // in dev. Serial adds latency but stays gentle; UX shows a
  // pending spinner meanwhile.
  for (const user_id of toAssign) {
    try {
      await enrol({ course_id: courseId, user_id });
      assigned += 1;
    } catch (err) {
      failures.push({
        user_id,
        label: userLabels[user_id] ?? user_id,
        error: mapError(err, "Enrol failed."),
      });
    }
  }

  revalidatePath("/academy/assignments");
  revalidatePath("/academy/mine");
  return {
    ok: failures.length === 0,
    assigned,
    skipped,
    failures,
  };
}

function mapError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) return "You don't have permission to assign courses.";
    if (err.status === 400) return err.message || fallback;
  }
  return fallback;
}
