"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  createWorkOrder,
  resolveSquawk,
  transitionWorkOrder,
  type WorkOrderStatus,
} from "@/lib/api/maintenance";
import { validationSummary } from "@/lib/api/validation-errors";

/**
 * Work orders from the web (#134): open one, from a squawk or not, and
 * move it through maintenance's states. The client, on the call: "when
 * you squawk the plane, it tells maintenance and maintenance opens up a
 * file". Completing or closing one can resolve its squawk in the same
 * step, which returns a grounded aircraft to service.
 */

export type NewWorkOrderState =
  | { status: "idle" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const NewSchema = z.object({
  aircraft_id: z.string().uuid({ message: "Pick the aircraft." }),
  title: z.string().trim().min(1, "Say what the work is.").max(200),
  description: optional,
  wo_type: z.enum([
    "corrective",
    "preventive",
    "modification",
    "inspection",
    "airworthiness_directive",
    "service_bulletin",
    "other",
  ]),
  priority: z.enum(["normal", "high", "aog"]),
  opened_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Give the date it opened."),
  due_date: optional,
  squawk_id: optional,
});

function refusal(err: unknown, what: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) {
      return "Only maintenance, the Director of Maintenance, the Chief Pilot, the Director of Operations or an Exec Admin can open or work a work order.";
    }
    if (err.status === 404) return "That aircraft or squawk isn't on file any more — refresh the page.";
    return validationSummary(err) ?? `Couldn't ${what} (HTTP ${err.status}). Try again in a moment.`;
  }
  return `Couldn't ${what}. Try again in a moment.`;
}

export async function createWorkOrderAction(
  _prev: NewWorkOrderState,
  formData: FormData,
): Promise<NewWorkOrderState> {
  const parsed = NewSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { status: "field-errors", errors };
  }
  let id: string;
  try {
    id = (await createWorkOrder(parsed.data)).id;
  } catch (err) {
    return { status: "api-error", message: refusal(err, "open the work order") };
  }
  revalidatePath("/maintenance/work-orders");
  revalidatePath("/maintenance/squawks");
  redirect(`/maintenance/work-orders/${id}`);
}

export type TransitionResult = { ok: true } | { ok: false; message: string };

const Transition = z.object({
  workOrderId: z.string().uuid(),
  toStatus: z.enum(["open", "in_progress", "awaiting_parts", "completed", "closed"]),
  note: z.string().trim().max(2000),
  resolveSquawkId: z.string().uuid().nullable(),
});

export async function transitionWorkOrderAction(input: {
  workOrderId: string;
  toStatus: WorkOrderStatus;
  note: string;
  /** Also resolve this squawk, with the note as what was done. */
  resolveSquawkId: string | null;
}): Promise<TransitionResult> {
  const parsed = Transition.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That change isn't valid." };
  const { workOrderId, toStatus, note, resolveSquawkId } = parsed.data;
  if (resolveSquawkId && !note) {
    return { ok: false, message: "Say what was done: it goes on the squawk as its resolution." };
  }
  try {
    await transitionWorkOrder(workOrderId, toStatus, note || null);
  } catch (err) {
    return { ok: false, message: refusal(err, "change the work order") };
  }
  if (resolveSquawkId) {
    try {
      await resolveSquawk(resolveSquawkId, { resolution_notes: note });
    } catch (err) {
      revalidatePath(`/maintenance/work-orders/${workOrderId}`);
      const why =
        err instanceof ApiError && err.status === 403
          ? "only maintenance, the Director of Maintenance or an Exec Admin can resolve a squawk"
          : "try resolving it from Squawks";
      return { ok: false, message: `The work order changed, but its squawk wasn't resolved: ${why}.` };
    }
  }
  revalidatePath(`/maintenance/work-orders/${workOrderId}`);
  revalidatePath("/maintenance/work-orders");
  revalidatePath("/maintenance/squawks");
  revalidatePath("/maintenance");
  revalidatePath("/dispatch");
  return { ok: true };
}
