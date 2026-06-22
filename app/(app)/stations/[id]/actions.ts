"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  createStationIssue,
  resolveStationIssue,
  updateStation,
} from "@/lib/api/ground";

/**
 * Station detail server actions (M2-G-38b):
 *   - reportIssueAction      → POST /ground/stations/{id}/issues
 *   - resolveIssueAction     → POST /ground/station-issues/{id}/resolve
 *
 * Both revalidate the station detail page on success so the issue
 * list re-renders without a full reload.
 */

const ReportSchema = z.object({
  station_id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().trim().min(1, "Description is required"),
  category: z
    .enum([
      "equipment",
      "facilities",
      "safety",
      "ops",
      "staffing",
      "weather",
      "fuel",
      "comms",
      "other",
    ])
    .default("other"),
  priority: z
    .enum(["low", "normal", "high", "critical"])
    .default("normal"),
  assigned_to: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ReportIssueState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export async function reportIssueAction(
  _prev: ReportIssueState,
  formData: FormData,
): Promise<ReportIssueState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = ReportSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "field-errors", errors };
  }

  try {
    await createStationIssue(parsed.data.station_id, {
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      priority: parsed.data.priority,
      assigned_to: parsed.data.assigned_to ?? null,
    });
  } catch (err) {
    return apiToState(err);
  }

  revalidatePath(`/stations/${parsed.data.station_id}`);
  return { status: "ok" };
}

const ResolveSchema = z.object({
  station_id: z.string().uuid(),
  issue_id: z.string().uuid(),
  resolution_notes: z
    .string()
    .trim()
    .min(1, "Resolution notes are required"),
});

export type ResolveIssueState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export async function resolveIssueAction(
  _prev: ResolveIssueState,
  formData: FormData,
): Promise<ResolveIssueState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = ResolveSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "field-errors", errors };
  }

  try {
    await resolveStationIssue(
      parsed.data.issue_id,
      parsed.data.resolution_notes,
    );
  } catch (err) {
    return apiToState(err);
  }

  revalidatePath(`/stations/${parsed.data.station_id}`);
  return { status: "ok" };
}

function apiToState(err: unknown): ReportIssueState {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return {
        status: "api-error",
        message: "Your session expired — please sign in again.",
      };
    }
    if (err.status === 409) {
      return {
        status: "api-error",
        message: "This issue is already resolved.",
      };
    }
    return {
      status: "api-error",
      message: `Action failed (HTTP ${err.status}). Try again in a moment.`,
    };
  }
  return {
    status: "api-error",
    message: "Action failed. Try again in a moment.",
  };
}


/**
 * Station deactivate / reactivate (Spec 6 §"Stations list page /
 * Active / Inactive toggle").
 *
 * Wraps PATCH /ground/stations/{id} with `is_active`. Revalidates the
 * station detail + the listing pages so dropdowns elsewhere refetch.
 * The full revalidateTag("stations") wiring lands in Base management
 * PR 3 — for now we revalidate the two stations pages explicitly.
 */

export interface SetActiveResult {
  ok: boolean;
  error?: string;
}

export async function setStationActiveAction(
  stationId: string,
  isActive: boolean,
): Promise<SetActiveResult> {
  try {
    await updateStation(stationId, { is_active: isActive });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return { ok: false, error: "Your session expired — sign in again." };
      }
      return { ok: false, error: `Couldn't save (HTTP ${err.status}).` };
    }
    return { ok: false, error: "Couldn't save — try again." };
  }
  revalidatePath(`/stations/${stationId}`);
  revalidatePath("/stations");
  return { ok: true };
}
