"use server";

import { revalidatePath } from "next/cache";

import {
  createLesson,
  deleteLesson,
  updateCourse,
  updateLesson,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

export interface AdminActionState {
  status: "idle" | "error" | "ok";
  message?: string;
}

async function _wrap(
  courseId: string,
  op: () => Promise<unknown>,
): Promise<AdminActionState> {
  try {
    await op();
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        status: "error",
        message: _mapAcademyError(err),
      };
    }
    return { status: "error", message: "Could not reach academy-service." };
  }
  revalidatePath(`/academy/studio/${courseId}`);
  revalidatePath(`/academy/${courseId}`);
  revalidatePath("/academy/studio");
  revalidatePath("/academy");
  return { status: "ok" };
}

// Backend surfaces linked-currency validation errors as specific
// `detail` strings (see services/academy/app/routes/courses.py).
// Translate the ones a chief pilot would actually hit into plain
// English so the picker doesn't render "Backend returned HTTP 400".
function _mapAcademyError(err: ApiError): string {
  const raw = err.message;
  let detail: string | undefined;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.detail === "string") detail = parsed.detail;
  } catch {
    // Non-JSON body — fall through to the generic message.
  }
  switch (detail) {
    case "currency_item_not_found":
      return "That currency item no longer exists. Pick another.";
    case "currency_item_inactive":
      return "That currency item is inactive. Reactivate it in Settings → Currency first.";
    case "check_events_cannot_be_linked_to_courses":
      return "Check events can't be linked — they require examiner sign-off outside the academy.";
    case "rolling_items_cannot_be_linked_to_courses":
      return "Rolling-window items can't be linked — they auto-fire from the elog instead.";
  }
  return `Backend returned HTTP ${err.status}.`;
}

/** Set (or clear) the compliance link on a course. Backend enforces
 *  eligibility (calendar-month, active, not check-event); the UI
 *  filters to eligible items so this action is mostly a safety net. */
export async function updateComplianceLinkAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const courseId = String(formData.get("course_id") ?? "");
  if (!courseId) return { status: "error", message: "Missing course id." };
  const raw = String(formData.get("linked_currency_item_id") ?? "").trim();
  const linkedId = raw === "" ? null : raw;
  return _wrap(courseId, () =>
    updateCourse(courseId, { linked_currency_item_id: linkedId }),
  );
}

export async function updatePublishStatusAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const courseId = String(formData.get("course_id") ?? "");
  const raw = String(formData.get("publish_status") ?? "");
  if (!courseId) return { status: "error", message: "Missing course id." };
  if (raw !== "draft" && raw !== "published" && raw !== "archived") {
    return { status: "error", message: "Invalid publish status." };
  }
  return _wrap(courseId, () =>
    updateCourse(courseId, { publish_status: raw }),
  );
}

export async function addLessonAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const courseId = String(formData.get("course_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body_markdown") ?? "");
  if (!courseId) return { status: "error", message: "Missing course id." };
  if (!title) {
    return { status: "error", message: "Lesson title is required." };
  }
  return _wrap(courseId, () =>
    createLesson(courseId, { title, body_markdown: body }),
  );
}

export async function updateLessonAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const courseId = String(formData.get("course_id") ?? "");
  const lessonId = String(formData.get("lesson_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body_markdown") ?? "");
  if (!courseId || !lessonId) {
    return { status: "error", message: "Missing ids." };
  }
  if (!title) {
    return { status: "error", message: "Lesson title is required." };
  }
  return _wrap(courseId, () =>
    updateLesson(lessonId, { title, body_markdown: body }),
  );
}

export async function deleteLessonAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const courseId = String(formData.get("course_id") ?? "");
  const lessonId = String(formData.get("lesson_id") ?? "");
  if (!courseId || !lessonId) {
    return { status: "error", message: "Missing ids." };
  }
  return _wrap(courseId, () => deleteLesson(lessonId));
}
