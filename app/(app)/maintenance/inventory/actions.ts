"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  createPart,
  lookupPart,
  movePart,
  removePart,
  updatePart,
  type Part,
  type PartInput,
} from "@/lib/api/maintenance";
import { refusalText } from "@/lib/api/validation-errors";

/**
 * Parts from the web (#172): add and edit them, take them off the list, and
 * move stock in and out, by hand or with a barcode.
 */

export type PartFormState =
  | { status: "idle" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export type PartActionResult = { ok: true } | { ok: false; message: string };

function refusal(err: unknown, what: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) {
      return "Only maintenance, the Director of Maintenance or an Exec Admin can change parts.";
    }
    if (err.status === 404) return "That part isn't on file any more — refresh the page.";
    return refusalText(err) ?? `Couldn't ${what} (HTTP ${err.status}). Try again in a moment.`;
  }
  return `Couldn't ${what}. Try again in a moment.`;
}

const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const count = (message: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => v || "0")
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), message);

const PartSchema = z.object({
  part_number: z.string().trim().min(1, "Give the part number.").max(100),
  description: z.string().trim().min(1, "Say what the part is.").max(500),
  category: z.string().trim().min(1),
  manufacturer: optional,
  unit_cost: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d+(\.\d{1,2})?$/.test(v), "Give the cost in dollars and cents."),
  unit: z.string().trim().min(1, "Give the unit, such as EA.").max(20),
  qty_on_hand: count("Give the quantity as a number, with up to two decimals."),
  qty_minimum: count("Give the minimum as a number, with up to two decimals."),
  location: optional,
  is_life_limited: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "1"),
  shelf_life_months: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0), "Give the shelf life in whole months."),
  expiration_date: optional,
  batch_number: optional,
  lot_number: optional,
  received_date: optional,
  notes: optional,
});

function parsePart(formData: FormData):
  | { ok: true; part: PartInput }
  | { ok: false; state: PartFormState } {
  const parsed = PartSchema.safeParse(Object.fromEntries(formData.entries()));
  if (parsed.success) return { ok: true, part: parsed.data };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return { ok: false, state: { status: "field-errors", errors } };
}

export async function createPartAction(_prev: PartFormState, formData: FormData): Promise<PartFormState> {
  const parsed = parsePart(formData);
  if (!parsed.ok) return parsed.state;
  let id: string;
  try {
    id = (await createPart(parsed.part)).id;
  } catch (err) {
    return { status: "api-error", message: refusal(err, "add the part") };
  }
  revalidatePath("/maintenance/inventory");
  redirect(`/maintenance/inventory/${id}`);
}

export async function updatePartAction(
  id: string,
  _prev: PartFormState,
  formData: FormData,
): Promise<PartFormState> {
  const parsed = parsePart(formData);
  if (!parsed.ok) return parsed.state;
  try {
    await updatePart(id, parsed.part);
  } catch (err) {
    return { status: "api-error", message: refusal(err, "save the part") };
  }
  revalidatePath("/maintenance/inventory");
  revalidatePath(`/maintenance/inventory/${id}`);
  redirect(`/maintenance/inventory/${id}`);
}

export async function removePartAction(id: string): Promise<PartActionResult> {
  try {
    await removePart(id);
  } catch (err) {
    return { ok: false, message: refusal(err, "remove the part") };
  }
  revalidatePath("/maintenance/inventory");
  redirect("/maintenance/inventory");
}

const MoveSchema = z.object({
  partId: z.string().uuid(),
  txn_type: z.enum(["received", "issued", "returned"]),
  quantity: z
    .string()
    .trim()
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Give a quantity above zero."),
  aircraft_id: optional,
  work_order_id: optional,
  reference: optional,
  batch_number: optional,
  lot_number: optional,
  notes: optional,
});

export async function movePartAction(input: {
  partId: string;
  txn_type: "received" | "issued" | "returned";
  quantity: string;
  aircraft_id?: string;
  work_order_id?: string;
  reference?: string;
  batch_number?: string;
  lot_number?: string;
  notes?: string;
}): Promise<PartActionResult & { qty?: number }> {
  const parsed = MoveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  const { partId, ...move } = parsed.data;
  let part: Part;
  try {
    part = await movePart(partId, move);
  } catch (err) {
    return { ok: false, message: refusal(err, "record that") };
  }
  revalidatePath("/maintenance/inventory");
  revalidatePath(`/maintenance/inventory/${partId}`);
  revalidatePath("/maintenance/expiration");
  revalidatePath("/maintenance/batch-trace");
  return { ok: true, qty: part.qty_on_hand };
}

export async function lookupPartAction(
  code: string,
): Promise<{ ok: true; parts: Part[] } | { ok: false; message: string }> {
  const cleaned = code.trim();
  if (!cleaned) return { ok: false, message: "Scan a barcode or type a part number." };
  try {
    return { ok: true, parts: await lookupPart(cleaned) };
  } catch (err) {
    return { ok: false, message: refusal(err, "look that up") };
  }
}
