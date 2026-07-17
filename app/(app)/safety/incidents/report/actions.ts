"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  HAZARD_SEVERITIES,
  INCIDENT_CATEGORIES,
  submitIncident,
} from "@/lib/api/safety";

const _schema = z.object({
  category: z.enum(INCIDENT_CATEGORIES as unknown as [string, ...string[]]),
  severity: z.enum(HAZARD_SEVERITIES as unknown as [string, ...string[]]),
  occurred_at_local: z.string().min(1, "When did this happen?"),
  description: z
    .string()
    .trim()
    .min(10, "Please describe the incident in at least 10 characters.")
    .max(4000),
  injury_summary: z
    .string()
    .trim()
    .min(1, "Injury impact required — write \"none\" if none.")
    .max(4000),
  damage_summary: z
    .string()
    .trim()
    .min(1, "Damage impact required — write \"none\" if none.")
    .max(4000),
  station_id: z.string().uuid().optional().or(z.literal("")),
  location_free_text: z.string().trim().max(200).optional(),
  immediate_action_taken: z.string().trim().max(4000).optional(),
  is_anonymous: z.string().optional(),
});

export interface IncidentReportFormState {
  status: "idle" | "error" | "ok";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export async function submitIncidentAction(
  _prev: IncidentReportFormState,
  formData: FormData,
): Promise<IncidentReportFormState> {
  const raw = {
    category: formData.get("category") ?? "",
    severity: formData.get("severity") ?? "",
    occurred_at_local: formData.get("occurred_at_local") ?? "",
    description: formData.get("description") ?? "",
    injury_summary: formData.get("injury_summary") ?? "",
    damage_summary: formData.get("damage_summary") ?? "",
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

  const v = parsed.data;

  // The <input type="datetime-local"> value is naive (no timezone).
  // Treat it as the reporter's local time and convert to ISO with the
  // server's offset. `new Date("2026-07-17T14:30")` already interprets
  // it as local in Node.
  let occurredAt: string;
  try {
    occurredAt = new Date(v.occurred_at_local).toISOString();
  } catch {
    return {
      status: "error",
      message: "Invalid occurrence time.",
      fieldErrors: { occurred_at_local: "Please pick a valid date and time." },
    };
  }

  let newId: string;
  try {
    const created = await submitIncident({
      category: v.category as never,
      severity: v.severity as never,
      occurred_at: occurredAt,
      description: v.description,
      injury_summary: v.injury_summary,
      damage_summary: v.damage_summary,
      station_id: v.station_id || null,
      location_free_text: v.location_free_text || null,
      immediate_action_taken: v.immediate_action_taken || null,
      is_anonymous: v.is_anonymous === "on",
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

  redirect(`/safety/incidents/${newId}?filed=1`);
}
