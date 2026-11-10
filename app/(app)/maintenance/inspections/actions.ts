"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  addInspectionItem,
  cancelInspection,
  failInspectionItem,
  passInspectionItem,
  removeInspectionItem,
  signOffInspection,
  startInspection,
  updateInspection,
  type CertType,
} from "@/lib/api/inspections";
import { refusalText } from "@/lib/api/validation-errors";

/**
 * Inspections from the web (#178): start one, work its checklist, and sign it
 * off. A failed item opens a squawk on the aircraft; the sign-off can record
 * the due-list item the inspection satisfies.
 */

export type InspectionFormState =
  | { status: "idle" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export type InspectionResult = { ok: true } | { ok: false; message: string };

function refusal(err: unknown, what: string, signing = false): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) {
      return signing
        ? "Only maintenance, the Director of Maintenance or an Exec Admin can sign an inspection off."
        : "Only maintenance, the Director of Maintenance or an Exec Admin can work an inspection.";
    }
    if (err.status === 404) return "That isn't on file any more — refresh the page.";
    return refusalText(err) ?? `Couldn't ${what} (HTTP ${err.status}). Try again in a moment.`;
  }
  return `Couldn't ${what}. Try again in a moment.`;
}

function refresh(id?: string) {
  revalidatePath("/maintenance/inspections");
  if (id) revalidatePath(`/maintenance/inspections/${id}`);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));
const optionalDay = optional.refine((v) => v === null || DAY.test(v), "Give a date.");
const optionalId = optional.refine((v) => v === null || UUID.test(v), "Pick one from the list.");

const DetailsSchema = z.object({
  inspection_type: z.string().trim().min(1),
  title: z.string().trim().min(1, "Give the inspection a title.").max(300),
  target_on: optionalDay,
  assigned_to_user_id: optionalId,
  vendor_id: optionalId,
  notes: optional,
});

const CreateSchema = DetailsSchema.extend({
  aircraft_id: z.string({ required_error: "Pick the aircraft." }).trim().regex(UUID, "Pick the aircraft."),
  started_on: optionalDay,
});

function fieldErrors(issues: z.ZodIssue[]): InspectionFormState {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
  return { status: "field-errors", errors };
}

export async function startInspectionAction(
  _prev: InspectionFormState,
  formData: FormData,
): Promise<InspectionFormState> {
  const parsed = CreateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  let id: string;
  try {
    id = (await startInspection({ ...parsed.data, work_order_id: null })).id;
  } catch (err) {
    return { status: "api-error", message: refusal(err, "start the inspection") };
  }
  refresh();
  redirect(`/maintenance/inspections/${id}`);
}

export async function updateInspectionAction(
  id: string,
  workOrderId: string | null,
  _prev: InspectionFormState,
  formData: FormData,
): Promise<InspectionFormState> {
  const parsed = DetailsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  try {
    await updateInspection(id, { ...parsed.data, work_order_id: workOrderId });
  } catch (err) {
    return { status: "api-error", message: refusal(err, "save the inspection") };
  }
  refresh(id);
  redirect(`/maintenance/inspections/${id}`);
}

export async function cancelInspectionAction(id: string): Promise<InspectionResult> {
  try {
    await cancelInspection(id);
  } catch (err) {
    return { ok: false, message: refusal(err, "cancel the inspection") };
  }
  refresh(id);
  return { ok: true };
}

const ItemSchema = z.object({
  section: z.string().trim().max(100).transform((v) => v || "General"),
  item_number: z
    .string()
    .trim()
    .max(20, "Keep the number to 20 characters.")
    .transform((v) => (v ? v : null)),
  description: z.string().trim().min(1, "Say what to check.").max(4000),
});

export async function addItemAction(
  id: string,
  input: { section: string; item_number: string; description: string },
): Promise<InspectionResult> {
  const parsed = ItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the item." };
  try {
    await addInspectionItem(id, parsed.data);
  } catch (err) {
    return { ok: false, message: refusal(err, "add the item") };
  }
  refresh(id);
  return { ok: true };
}

export async function removeItemAction(id: string, itemId: string): Promise<InspectionResult> {
  try {
    await removeInspectionItem(id, itemId);
  } catch (err) {
    return { ok: false, message: refusal(err, "remove the item") };
  }
  refresh(id);
  return { ok: true };
}

export async function passItemAction(id: string, itemId: string): Promise<InspectionResult> {
  try {
    await passInspectionItem(id, itemId);
  } catch (err) {
    return { ok: false, message: refusal(err, "record that") };
  }
  refresh(id);
  return { ok: true };
}

const FailSchema = z.object({
  finding: z.string().trim().min(1, "Say what was found: it becomes the squawk.").max(4000),
  severity: z.enum(["minor", "major", "grounding"]),
});

export async function failItemAction(
  id: string,
  itemId: string,
  input: { finding: string; severity: string },
): Promise<InspectionResult> {
  const parsed = FailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the finding." };
  try {
    await failInspectionItem(id, itemId, parsed.data);
  } catch (err) {
    return { ok: false, message: refusal(err, "record the discrepancy") };
  }
  refresh(id);
  revalidatePath("/maintenance/squawks");
  revalidatePath("/maintenance");
  return { ok: true };
}

const SignOffSchema = z.object({
  signed_off_on: z.string().trim().regex(DAY, "Give the date of the sign-off."),
  signer_name: z.string().trim().min(1, "Give the signer's name.").max(200),
  cert_number: z.string().trim().min(1, "Give the certificate number.").max(64),
  cert_type: z.enum(["ap", "ia", "repairman"]),
  total_time_hours: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Give the total time in hours."),
  notes: optional,
  due_item_id: optionalId,
});

export async function signOffAction(
  id: string,
  input: {
    signed_off_on: string;
    signer_name: string;
    cert_number: string;
    cert_type: CertType;
    total_time_hours: string;
    notes: string;
    due_item_id: string;
  },
): Promise<InspectionResult> {
  const parsed = SignOffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the sign-off." };
  try {
    await signOffInspection(id, parsed.data);
  } catch (err) {
    return { ok: false, message: refusal(err, "sign the inspection off", true) };
  }
  refresh(id);
  revalidatePath("/maintenance/due-list");
  revalidatePath("/maintenance");
  return { ok: true };
}
