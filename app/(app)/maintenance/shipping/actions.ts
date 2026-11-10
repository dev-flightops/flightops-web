"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { createShipment, updateShipmentStatus, type ShipmentStatusInput } from "@/lib/api/part-logistics";
import { refusalText } from "@/lib/api/validation-errors";

/**
 * Shipping from the web (#178): enter a shipment between bases or from a
 * vendor, and mark it on its way, arrived or cancelled. Stock moves in the
 * maintenance service: off the sending base's row when a transfer is entered,
 * onto the receiving base's row when it arrives.
 */

export type ShipmentFormState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export type ShipmentResult = { ok: true } | { ok: false; message: string };

function refusal(err: unknown, what: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) return "Only maintenance, the Director of Maintenance or an Exec Admin can ship parts.";
    if (err.status === 404) return "That part or shipment isn't on file any more — refresh the page.";
    return refusalText(err) ?? `Couldn't ${what} (HTTP ${err.status}). Try again in a moment.`;
  }
  return `Couldn't ${what}. Try again in a moment.`;
}

function refreshParts() {
  revalidatePath("/maintenance/shipping");
  revalidatePath("/maintenance/parts-requests");
  revalidatePath("/maintenance/inventory", "layout");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));
const optionalDay = optional.refine((v) => v === null || DAY.test(v), "Give a date.");

const ShipmentSchema = z
  .object({
    kind: z.enum(["transfer", "vendor"]),
    part_id: z.string({ required_error: "Pick the part." }).trim().regex(UUID, "Pick the part."),
    quantity: z
      .string()
      .trim()
      .refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Give a quantity above zero."),
    dest_base: optional,
    vendor_id: optional,
    status: z.enum(["ordered", "shipped"]).optional(),
    airway_bill: optional,
    carrier: optional,
    shipped_on: optionalDay,
    est_arrival_on: optionalDay,
    notes: optional,
  })
  .superRefine((value, ctx) => {
    if (value.kind === "transfer" && !value.dest_base) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dest_base"], message: "Pick the base it's going to." });
    }
    if (value.kind === "vendor" && !(value.vendor_id && UUID.test(value.vendor_id))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["vendor_id"], message: "Pick the vendor sending it." });
    }
  });

export async function createShipmentAction(_prev: ShipmentFormState, formData: FormData): Promise<ShipmentFormState> {
  const parsed = ShipmentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { status: "field-errors", errors };
  }
  const { kind, dest_base, vendor_id, status, ...rest } = parsed.data;
  try {
    const shipment = await createShipment({
      kind,
      ...rest,
      dest_base: kind === "transfer" ? dest_base : null,
      vendor_id: kind === "vendor" ? vendor_id : null,
      status: kind === "vendor" ? (status ?? "ordered") : "shipped",
    });
    refreshParts();
    return {
      status: "saved",
      message:
        kind === "transfer"
          ? `${shipment.part_number} shipped from ${shipment.origin_base} to ${shipment.dest_base}.`
          : `${shipment.part_number} from ${shipment.vendor_name} entered for ${shipment.dest_base}.`,
    };
  } catch (err) {
    return { status: "api-error", message: refusal(err, "enter the shipment") };
  }
}

export async function updateShipmentStatusAction(id: string, input: ShipmentStatusInput): Promise<ShipmentResult> {
  if (input.on && !DAY.test(input.on)) return { ok: false, message: "Give a date." };
  try {
    await updateShipmentStatus(id, { ...input, on: input.on || null });
  } catch (err) {
    return { ok: false, message: refusal(err, "update the shipment") };
  }
  refreshParts();
  return { ok: true };
}
