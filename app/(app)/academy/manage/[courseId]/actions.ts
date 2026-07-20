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
        message: `Backend returned HTTP ${err.status}.`,
      };
    }
    return { status: "error", message: "Could not reach academy-service." };
  }
  revalidatePath(`/academy/manage/${courseId}`);
  revalidatePath("/academy/manage");
  revalidatePath("/academy");
  return { status: "ok" };
}

export async function toggleActiveAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const courseId = String(formData.get("course_id") ?? "");
  const isActive = formData.get("is_active") === "on";
  if (!courseId) return { status: "error", message: "Missing course id." };
  return _wrap(courseId, () =>
    updateCourse(courseId, { is_active: isActive }),
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
