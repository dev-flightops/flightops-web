"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  COURSE_CATEGORIES,
  COURSE_PUBLISH_STATUSES,
  type CourseCategory,
  type CoursePublishStatus,
  createCourse,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

const _schema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().trim().max(10_000).optional(),
  category: z.enum(COURSE_CATEGORIES as unknown as [string, ...string[]]),
  cert_valid_days: z
    .string()
    .transform((s) => Number(s))
    .refine(
      (n) => Number.isFinite(n) && n >= 0 && n <= 3650,
      "Cert valid days must be 0-3650.",
    ),
  publish_status: z.enum(
    COURSE_PUBLISH_STATUSES as unknown as [string, ...string[]],
  ),
});

export interface NewCourseFormState {
  status: "idle" | "error" | "ok";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export async function createCourseAction(
  _prev: NewCourseFormState,
  formData: FormData,
): Promise<NewCourseFormState> {
  const parsed = _schema.safeParse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    category: formData.get("category") ?? "",
    cert_valid_days: formData.get("cert_valid_days") ?? "365",
    publish_status: formData.get("publish_status") ?? "draft",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const v = parsed.data;
  let newId: string;
  try {
    const created = await createCourse({
      title: v.title,
      description: v.description || null,
      category: v.category as CourseCategory,
      cert_valid_days: v.cert_valid_days,
      publish_status: v.publish_status as CoursePublishStatus,
    });
    newId = created.id;
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
  redirect(`/academy/studio/${newId}?created=1`);
}
