"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  changeGseStatus,
  completeGseMaintenance,
  createGseMaintenance,
  createGseSquawk,
  resolveGseSquawk,
} from "@/lib/api/ground";

/**
 * Equipment detail server actions (M2-G-39b):
 *   - changeStatusAction        → POST /ground/gse/{id}/status
 *   - reportSquawkAction        → POST /ground/gse/{id}/squawks
 *   - resolveSquawkAction       → POST /ground/gse/squawks/{sid}/resolve
 *   - scheduleMaintenanceAction → POST /ground/gse/{id}/maintenance
 *   - completeMaintenanceAction → POST /ground/gse/{id}/maintenance/{mxid}/complete
 *
 * Each revalidates the equipment detail page on success so the panel
 * re-renders with the new state without a full reload.
 */

type ActionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

const StatusSchema = z.object({
  unit_id: z.string().uuid(),
  status: z.enum(["operational", "maintenance", "out_of_service"]),
  status_note: z
    .string()
    .max(2000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function changeStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = StatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodToFieldErrors(parsed.error.issues);
  try {
    await changeGseStatus(
      parsed.data.unit_id,
      parsed.data.status,
      parsed.data.status_note ?? null,
    );
  } catch (err) {
    return apiToState(err);
  }
  revalidatePath(`/equipment/${parsed.data.unit_id}`);
  return { status: "ok" };
}

const ReportSquawkSchema = z.object({
  unit_id: z.string().uuid(),
  description: z.string().trim().min(1, "Description is required"),
  reported_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Reported date is required (YYYY-MM-DD)"),
});

export async function reportSquawkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = ReportSquawkSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) return zodToFieldErrors(parsed.error.issues);
  try {
    await createGseSquawk(
      parsed.data.unit_id,
      parsed.data.description,
      parsed.data.reported_date,
    );
  } catch (err) {
    return apiToState(err);
  }
  revalidatePath(`/equipment/${parsed.data.unit_id}`);
  return { status: "ok" };
}

const ResolveSquawkSchema = z.object({
  unit_id: z.string().uuid(),
  squawk_id: z.string().uuid(),
  resolution_notes: z
    .string()
    .trim()
    .min(1, "Resolution notes are required"),
});

export async function resolveSquawkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = ResolveSquawkSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) return zodToFieldErrors(parsed.error.issues);
  try {
    await resolveGseSquawk(
      parsed.data.squawk_id,
      parsed.data.resolution_notes,
    );
  } catch (err) {
    return apiToState(err);
  }
  revalidatePath(`/equipment/${parsed.data.unit_id}`);
  return { status: "ok" };
}

const ScheduleMxSchema = z
  .object({
    unit_id: z.string().uuid(),
    title: z.string().trim().min(1, "Title is required").max(300),
    description: z
      .string()
      .max(2000)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    item_type: z
      .enum(["service", "inspection", "calibration", "certification", "custom"])
      .default("service"),
    interval_days: z
      .string()
      .optional()
      .transform((v) => (v && v !== "" ? Number(v) : undefined))
      .refine((v) => v === undefined || (Number.isInteger(v) && v >= 1), {
        message: "Interval days must be ≥ 1",
      }),
    interval_hours: z
      .string()
      .optional()
      .transform((v) => (v && v !== "" ? Number(v) : undefined))
      .refine((v) => v === undefined || (Number.isFinite(v) && v > 0), {
        message: "Interval hours must be > 0",
      }),
    due_date: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    is_recurring: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
  })
  .refine(
    (d) => d.interval_days !== undefined || d.interval_hours !== undefined,
    {
      message: "Provide an interval (days or hours).",
      path: ["interval_days"],
    },
  );

export async function scheduleMaintenanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = ScheduleMxSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) return zodToFieldErrors(parsed.error.issues);
  try {
    await createGseMaintenance(parsed.data.unit_id, {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      item_type: parsed.data.item_type,
      interval_days: parsed.data.interval_days ?? null,
      interval_hours: parsed.data.interval_hours ?? null,
      due_date: parsed.data.due_date || null,
      is_recurring: parsed.data.is_recurring,
    });
  } catch (err) {
    return apiToState(err);
  }
  revalidatePath(`/equipment/${parsed.data.unit_id}`);
  return { status: "ok" };
}

const CompleteMxSchema = z.object({
  unit_id: z.string().uuid(),
  mx_id: z.string().uuid(),
  completed_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Completed date is required (YYYY-MM-DD)"),
  completed_hours: z
    .string()
    .optional()
    .transform((v) => (v && v !== "" ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
      message: "Completed hours must be ≥ 0",
    }),
});

export async function completeMaintenanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = CompleteMxSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) return zodToFieldErrors(parsed.error.issues);
  try {
    await completeGseMaintenance(parsed.data.unit_id, parsed.data.mx_id, {
      completed_date: parsed.data.completed_date,
      completed_hours: parsed.data.completed_hours,
    });
  } catch (err) {
    return apiToState(err);
  }
  revalidatePath(`/equipment/${parsed.data.unit_id}`);
  return { status: "ok" };
}

function zodToFieldErrors(
  issues: { path: (string | number)[]; message: string }[],
): ActionState {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "_");
    if (!errors[key]) errors[key] = issue.message;
  }
  return { status: "field-errors", errors };
}

function apiToState(err: unknown): ActionState {
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
        message: "This record is already in the requested state.",
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

export type { ActionState as EquipmentActionState };
