"use server";

import { revalidatePath } from "next/cache";

import { completeLesson } from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

export interface CompleteLessonState {
  status: "idle" | "error" | "ok";
  message?: string;
}

export async function completeLessonAction(
  _prev: CompleteLessonState,
  formData: FormData,
): Promise<CompleteLessonState> {
  const enrollmentId = String(formData.get("enrollment_id") ?? "");
  const lessonId = String(formData.get("lesson_id") ?? "");
  if (!enrollmentId || !lessonId) {
    return { status: "error", message: "Missing enrollment or lesson id." };
  }

  try {
    await completeLesson(enrollmentId, lessonId);
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        status: "error",
        message: `Backend returned HTTP ${err.status}.`,
      };
    }
    return { status: "error", message: "Could not reach academy-service." };
  }
  revalidatePath(`/academy/enrollments/${enrollmentId}`);
  revalidatePath("/academy/mine");
  return { status: "ok" };
}
