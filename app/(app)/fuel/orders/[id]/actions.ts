"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  cancelFuelOrder,
  confirmFuelOrder,
  markFuelOrderFueled,
} from "@/lib/api/ground";

type ActionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

const ConfirmSchema = z.object({
  order_id: z.string().uuid(),
  confirmed_by_name: z.string().trim().min(1, "Name is required").max(200),
  confirmed_note: z
    .string()
    .max(2000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function confirmOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = ConfirmSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) return zodToFieldErrors(parsed.error.issues);
  try {
    await confirmFuelOrder(
      parsed.data.order_id,
      parsed.data.confirmed_by_name,
      parsed.data.confirmed_note ?? null,
    );
  } catch (err) {
    return apiToState(err);
  }
  revalidatePath(`/fuel/orders/${parsed.data.order_id}`);
  return { status: "ok" };
}

const FueledSchema = z.object({
  order_id: z.string().uuid(),
  fueled_by_name: z.string().trim().min(1, "Name is required").max(200),
  actual_quantity_gallons: z
    .string()
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v) && v >= 0, {
      message: "Actual gallons must be ≥ 0",
    }),
  discrepancy_reason: z
    .string()
    .max(2000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  closed_by_source: z.enum(["supplier", "ramp", "dispatch"]).default("ramp"),
});

export async function fueledOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = FueledSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) return zodToFieldErrors(parsed.error.issues);
  try {
    await markFuelOrderFueled(parsed.data.order_id, {
      fueled_by_name: parsed.data.fueled_by_name,
      actual_quantity_gallons: parsed.data.actual_quantity_gallons,
      discrepancy_reason: parsed.data.discrepancy_reason ?? null,
      closed_by_source: parsed.data.closed_by_source,
      invoice_pending: true,
    });
  } catch (err) {
    return apiToState(err);
  }
  revalidatePath(`/fuel/orders/${parsed.data.order_id}`);
  return { status: "ok" };
}

const CancelSchema = z.object({
  order_id: z.string().uuid(),
  cancel_reason: z
    .string()
    .trim()
    .min(1, "Cancel reason is required")
    .max(2000),
});

export async function cancelOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = CancelSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) return zodToFieldErrors(parsed.error.issues);
  try {
    await cancelFuelOrder(
      parsed.data.order_id,
      parsed.data.cancel_reason,
      "dispatch",
    );
  } catch (err) {
    return apiToState(err);
  }
  revalidatePath(`/fuel/orders/${parsed.data.order_id}`);
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
        message: "This order is already in a terminal state.",
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

export type { ActionState as FuelOrderActionState };
