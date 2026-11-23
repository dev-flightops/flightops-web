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
import type { Closure, SignOff } from "@/lib/api/types";
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

// 1119-19: closing, and resolving its squawk, are signed off (14 CFR 43.9).
const SignOffSchema = z.object({
  work_done: z.string().trim().min(1).max(4000),
  signer_name: z.string().trim().min(1).max(200),
  cert_number: z.string().trim().min(1).max(64),
  cert_type: z.enum(["ap", "ia", "repairman"]),
  airworthy: z.literal(true),
});

const Transition = z.object({
  workOrderId: z.string().uuid(),
  toStatus: z.enum(["open", "in_progress", "awaiting_parts", "completed", "closed"]),
  note: z.string().trim().max(2000),
  closure: z
    .union([z.object({ sign_off: SignOffSchema }), z.object({ no_work_reason: z.string().trim().min(1).max(2000) })])
    .nullable(),
  resolveSquawk: z.object({ id: z.string().uuid(), signOff: SignOffSchema }).nullable(),
});

export async function transitionWorkOrderAction(input: {
  workOrderId: string;
  toStatus: WorkOrderStatus;
  note: string;
  /** Closing needs it: the sign-off, or why no work was done. */
  closure: Closure | null;
  /** Also resolve this squawk, signed off with this. */
  resolveSquawk: { id: string; signOff: SignOff } | null;
}): Promise<TransitionResult> {
  const parsed = Transition.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        input.toStatus === "closed" || input.resolveSquawk
          ? "The sign-off needs the work done, the mechanic, their certificate number and kind, and the statement."
          : "That change isn't valid.",
    };
  }
  const { workOrderId, toStatus, note, closure, resolveSquawk: squawk } = parsed.data;
  if (toStatus === "closed" && !closure) {
    return { ok: false, message: "Sign it off to close it, or say why no work was done." };
  }
  try {
    await transitionWorkOrder(workOrderId, toStatus, note || null, closure);
  } catch (err) {
    return { ok: false, message: refusal(err, "change the work order") };
  }
  if (squawk) {
    try {
      await resolveSquawk(squawk.id, {
        resolution_notes: squawk.signOff.work_done,
        signer_name: squawk.signOff.signer_name,
        cert_number: squawk.signOff.cert_number,
        cert_type: squawk.signOff.cert_type,
        airworthy: true,
      });
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
