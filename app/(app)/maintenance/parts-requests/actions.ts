"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  approvePartRequest,
  cancelPartRequest,
  createPartRequest,
  denyPartRequest,
  shipPartRequest,
} from "@/lib/api/part-logistics";
import { refusalText } from "@/lib/api/validation-errors";

/**
 * Parts requests from the web (#178): one base asks another for stock it
 * holds; the sending base approves or denies, and ships it, which enters the
 * shipment. Its arrival fulfils the request.
 */

export type RequestFormState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export type RequestResult = { ok: true } | { ok: false; message: string };

function refusal(err: unknown, what: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) {
      return "Only maintenance, the Director of Maintenance or an Exec Admin can request or send parts.";
    }
    if (err.status === 404) return "That part or request isn't on file any more — refresh the page.";
    return refusalText(err) ?? `Couldn't ${what} (HTTP ${err.status}). Try again in a moment.`;
  }
  return `Couldn't ${what}. Try again in a moment.`;
}

function refresh() {
  revalidatePath("/maintenance/parts-requests");
  revalidatePath("/maintenance/shipping");
  revalidatePath("/maintenance/inventory", "layout");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const RequestSchema = z.object({
  part_id: z.string({ required_error: "Pick the part." }).trim().regex(UUID, "Pick the part."),
  quantity: z
    .string()
    .trim()
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Give a quantity above zero."),
  requesting_base: z.string().trim().min(1, "Pick the base asking for it.").max(10),
  priority: z.enum(["normal", "urgent", "aog"]),
  notes: optional,
});

export async function createRequestAction(_prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const parsed = RequestSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { status: "field-errors", errors };
  }
  try {
    const request = await createPartRequest(parsed.data);
    refresh();
    return {
      status: "saved",
      message: `Asked ${request.fulfilling_base} for ${request.quantity} ${request.unit} of ${request.part_number}.`,
    };
  } catch (err) {
    return { status: "api-error", message: refusal(err, "send the request") };
  }
}

export async function approveRequestAction(id: string): Promise<RequestResult> {
  try {
    await approvePartRequest(id, null);
  } catch (err) {
    return { ok: false, message: refusal(err, "approve the request") };
  }
  refresh();
  return { ok: true };
}

export async function denyRequestAction(id: string, why: string): Promise<RequestResult> {
  const reason = why.trim();
  if (!reason) return { ok: false, message: "Say why it's denied." };
  try {
    await denyPartRequest(id, reason);
  } catch (err) {
    return { ok: false, message: refusal(err, "deny the request") };
  }
  refresh();
  return { ok: true };
}

export async function shipRequestAction(
  id: string,
  input: { airway_bill: string; carrier: string; est_arrival_on: string },
): Promise<RequestResult> {
  if (input.est_arrival_on && !DAY.test(input.est_arrival_on)) return { ok: false, message: "Give a date." };
  try {
    await shipPartRequest(id, {
      airway_bill: input.airway_bill.trim() || null,
      carrier: input.carrier.trim() || null,
      est_arrival_on: input.est_arrival_on || null,
    });
  } catch (err) {
    return { ok: false, message: refusal(err, "ship the request") };
  }
  refresh();
  return { ok: true };
}

export async function cancelRequestAction(id: string): Promise<RequestResult> {
  try {
    await cancelPartRequest(id);
  } catch (err) {
    return { ok: false, message: refusal(err, "cancel the request") };
  }
  refresh();
  return { ok: true };
}
