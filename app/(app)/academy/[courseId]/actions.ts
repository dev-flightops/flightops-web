"use server";

import { redirect } from "next/navigation";

import { enrol } from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";
import { validationSummary } from "@/lib/api/validation-errors";

export interface EnrolFormState {
  status: "idle" | "error";
  message?: string;
}

export async function enrolAction(
  _prev: EnrolFormState,
  formData: FormData,
): Promise<EnrolFormState> {
  const courseId = String(formData.get("course_id") ?? "");
  if (!courseId) return { status: "error", message: "Missing course id." };

  let enrollmentId: string;
  try {
    const created = await enrol({ course_id: courseId });
    enrollmentId = created.id;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409 && err.message.includes("course_has_no_lessons")) {
        return { status: "error", message: "This course has no lessons yet. Ask the course author to add a lesson before enrolling." };
      }
      return {
        status: "error",
        message: validationSummary(err) ?? `That didn't save (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return {
      status: "error",
      message: "Could not reach academy-service.",
    };
  }
  redirect(`/academy/enrollments/${enrollmentId}`);
}
