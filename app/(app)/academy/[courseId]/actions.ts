"use server";

import { redirect } from "next/navigation";

import { enrol } from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

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
      return {
        status: "error",
        message: `Backend rejected the request (HTTP ${err.status}).`,
      };
    }
    return {
      status: "error",
      message: "Could not reach academy-service.",
    };
  }
  redirect(`/academy/enrollments/${enrollmentId}`);
}
