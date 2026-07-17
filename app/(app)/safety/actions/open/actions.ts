"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { type CapaSourceType, openCapa } from "@/lib/api/safety";

const _schema = z.object({
  source_type: z.enum(["hazard", "incident"]),
  source_id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z
    .string()
    .trim()
    .min(10, "Please describe the action in at least 10 characters.")
    .max(4000),
  owner_user_id: z.string().uuid("Pick an owner."),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a due date."),
});

export interface OpenCapaFormState {
  status: "idle" | "error" | "ok";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export async function openCapaAction(
  _prev: OpenCapaFormState,
  formData: FormData,
): Promise<OpenCapaFormState> {
  const parsed = _schema.safeParse({
    source_type: formData.get("source_type"),
    source_id: formData.get("source_id"),
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    owner_user_id: formData.get("owner_user_id") ?? "",
    due_date: formData.get("due_date") ?? "",
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
    const created = await openCapa({
      source_type: v.source_type as CapaSourceType,
      source_id: v.source_id,
      title: v.title,
      description: v.description,
      owner_user_id: v.owner_user_id,
      due_date: v.due_date,
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
      message: "Could not reach safety-service. Try again in a moment.",
    };
  }

  redirect(`/safety/actions/${newId}?opened=1`);
}
