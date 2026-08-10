"use server";

import { revalidatePath } from "next/cache";

import {
  completeLesson,
  submitQuizAttempt,
  type QuizAttemptResponse,
} from "@/lib/api/academy";
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
      // Backend gates complete-lesson on a passing quiz attempt.
      // Translate the 409 into copy that tells the learner to take
      // the quiz first instead of the raw "HTTP 409".
      if (err.status === 409 && /quiz_not_passed/.test(err.message)) {
        return {
          status: "error",
          message:
            "This lesson has a quiz — pass it first before marking complete.",
        };
      }
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

export interface SubmitQuizState {
  status: "idle" | "error" | "ok";
  message?: string;
  attempt?: QuizAttemptResponse;
}

export async function submitQuizAction(
  enrollmentId: string,
  quizId: string,
  answers: number[],
): Promise<SubmitQuizState> {
  if (!enrollmentId || !quizId) {
    return { status: "error", message: "Missing enrollment or quiz id." };
  }
  try {
    const attempt = await submitQuizAttempt(enrollmentId, quizId, answers);
    // Revalidate the parent lesson view so `listMyQuizAttempts` on
    // the next render sees the new attempt (and the Mark Complete
    // button unlocks when is_pass is true).
    revalidatePath(`/academy/enrollments/${enrollmentId}`);
    return { status: "ok", attempt };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        status: "error",
        message: `Backend returned HTTP ${err.status}.`,
      };
    }
    return { status: "error", message: "Could not reach academy-service." };
  }
}
