"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { HAZARD_CATEGORIES, HAZARD_SEVERITIES, submitHazard } from "@/lib/api/safety";

const _schema = z.object({
  category: z.enum(HAZARD_CATEGORIES as unknown as [string, ...string[]]),
  severity: z.enum(HAZARD_SEVERITIES as unknown as [string, ...string[]]),
  description: z
    .string()
    .trim()
    .min(10, "Please describe the hazard in at least 10 characters.")
    .max(4000),
  station_id: z.string().uuid().optional().or(z.literal("")),
  location_free_text: z.string().trim().max(200).optional(),
  immediate_action_taken: z.string().trim().max(4000).optional(),
  is_anonymous: z.string().optional(),
});

export interface ReportFormState {
  status: "idle" | "error" | "ok";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export async function submitHazardAction(
  _prev: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  const raw = {
    category: formData.get("category") ?? "",
    severity: formData.get("severity") ?? "",
    description: formData.get("description") ?? "",
    station_id: formData.get("station_id") ?? "",
    location_free_text: formData.get("location_free_text") ?? "",
    immediate_action_taken: formData.get("immediate_action_taken") ?? "",
    is_anonymous: formData.get("is_anonymous") ?? "",
  };

  const parsed = _schema.safeParse(raw);
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

  const values = parsed.data;
  let newId: string;
  try {
    const created = await submitHazard({
      // Zod's enum() returns a plain string; the backend Literal validates
      // it — safe to cast here.
      category: values.category as never,
      severity: values.severity as never,
      description: values.description,
      station_id: values.station_id || null,
      location_free_text: values.location_free_text || null,
      immediate_action_taken: values.immediate_action_taken || null,
      is_anonymous: values.is_anonymous === "on",
    });
    newId = created.id;
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        status: "error",
        message:
          err.status === 401
            ? "Your session expired — please sign in again."
            : `Backend rejected the report (HTTP ${err.status}).`,
      };
    }
    return {
      status: "error",
      message: "Could not reach safety-service. Try again in a moment.",
    };
  }

  redirect(`/safety/${newId}?filed=1`);
}
