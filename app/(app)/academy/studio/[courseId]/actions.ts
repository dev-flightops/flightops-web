"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { mediaRefusalWords } from "@/lib/academy/media";
import {
  addLessonMediaDocument,
  addLessonMediaLink,
  completeLessonMediaUpload,
  createLesson,
  createLessonQuiz,
  deleteLesson,
  deleteLessonMedia,
  startLessonMediaUpload,
  updateCourse,
  updateLesson,
  updateLessonMedia,
  uploadLessonMedia,
  type LessonMediaUploadTicket,
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
    case "lesson_already_has_quiz":
      return "This lesson already has a quiz — refresh to see the Edit Quiz link.";
    case "lesson_not_found":
      return "Lesson not found — it may have been deleted in another tab.";
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

/** POST /academy/lessons/{id}/quiz — attach a fresh quiz to a lesson,
 *  then redirect the author straight into the quiz editor so they can
 *  start adding questions. Uses a minimal default title (`Quiz — {n}`
 *  set by the backend if we send just placeholder text) and the
 *  service's default pass_threshold of 80. */
export async function attachQuizAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const courseId = String(formData.get("course_id") ?? "");
  const lessonId = String(formData.get("lesson_id") ?? "");
  if (!courseId || !lessonId) {
    return { status: "error", message: "Missing ids." };
  }
  let quizId: string | null = null;
  try {
    const quiz = await createLessonQuiz(lessonId, {
      title: "New Quiz",
      instructions: null,
    });
    quizId = quiz.id;
  } catch (err) {
    if (err instanceof ApiError) {
      return { status: "error", message: _mapAcademyError(err) };
    }
    return { status: "error", message: "Could not reach academy-service." };
  }
  // Revalidate the studio page so lesson.quiz_id shows on the next
  // paint even if the user clicks Back from the editor.
  revalidatePath(`/academy/studio/${courseId}`);
  redirect(`/academy/studio/quizzes/${quizId}`);
}

// ---- A lesson's pictures, videos and PDFs (#170) ---------------------------

export interface MediaResult {
  error: string | null;
}

async function _media(courseId: string, op: () => Promise<unknown>): Promise<MediaResult> {
  try {
    await op();
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: mediaRefusalWords(err.message) ?? `Backend returned HTTP ${err.status}.` };
    }
    return { error: "Could not reach academy-service." };
  }
  revalidatePath(`/academy/studio/${courseId}`);
  revalidatePath(`/academy/${courseId}`);
  return { error: null };
}

/** A file small enough to come through here. */
export async function addMediaFileAction(formData: FormData): Promise<MediaResult> {
  const courseId = String(formData.get("course_id") ?? "");
  const lessonId = String(formData.get("lesson_id") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  const form = new FormData();
  form.set("file", file);
  form.set("title", String(formData.get("title") ?? ""));
  form.set("must_finish", formData.get("must_finish") ? "true" : "false");
  return _media(courseId, () => uploadLessonMedia(lessonId, form));
}

/** A URL to send a large file straight to the bucket (#17). */
export async function startMediaUploadAction(
  lessonId: string,
  file: { filename: string; size: number },
): Promise<{ ticket: LessonMediaUploadTicket | null; error: string | null }> {
  try {
    const ticket = await startLessonMediaUpload(lessonId, {
      filename: file.filename,
      size_bytes: file.size,
    });
    return { ticket, error: null };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        ticket: null,
        error: mediaRefusalWords(err.message) ?? `Backend returned HTTP ${err.status}.`,
      };
    }
    return { ticket: null, error: "Could not reach academy-service." };
  }
}

export async function completeMediaUploadAction(
  courseId: string,
  lessonId: string,
  input: { fileKey: string; filename: string; title: string; mustFinish: boolean },
): Promise<MediaResult> {
  return _media(courseId, () =>
    completeLessonMediaUpload(lessonId, {
      file_key: input.fileKey,
      filename: input.filename,
      title: input.title || null,
      must_finish: input.mustFinish,
    }),
  );
}

export async function addMediaLinkAction(
  courseId: string,
  lessonId: string,
  input: { url: string; title: string; mustFinish: boolean },
): Promise<MediaResult> {
  return _media(courseId, () =>
    addLessonMediaLink(lessonId, {
      url: input.url,
      title: input.title || null,
      must_finish: input.mustFinish,
    }),
  );
}

export async function addMediaDocumentAction(
  courseId: string,
  lessonId: string,
  input: { documentId: string; title: string; mustFinish: boolean },
): Promise<MediaResult> {
  return _media(courseId, () =>
    addLessonMediaDocument(lessonId, {
      document_id: input.documentId,
      title: input.title || null,
      must_finish: input.mustFinish,
    }),
  );
}

export async function updateMediaAction(
  courseId: string,
  mediaId: string,
  change: { title?: string; must_finish?: boolean; move?: "up" | "down" },
): Promise<MediaResult> {
  return _media(courseId, () => updateLessonMedia(mediaId, change));
}

export async function removeMediaAction(courseId: string, mediaId: string): Promise<MediaResult> {
  return _media(courseId, () => deleteLessonMedia(mediaId));
}
