"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { createVendor, removeVendor, updateVendor, type MxVendorInput } from "@/lib/api/mx-vendors";
import { refusalText } from "@/lib/api/validation-errors";

/** Vendors from the web (#178): add, edit and take one off the list. */

export type VendorFormState =
  | { status: "idle" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

function refusal(err: unknown, what: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) return "Only maintenance, the Director of Maintenance or an Exec Admin can change vendors.";
    if (err.status === 404) return "That vendor isn't on file any more — refresh the page.";
    return refusalText(err) ?? `Couldn't ${what} (HTTP ${err.status}). Try again in a moment.`;
  }
  return `Couldn't ${what}. Try again in a moment.`;
}

const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const VendorSchema = z.object({
  name: z.string().trim().min(1, "Give the vendor's name.").max(300),
  vendor_type: z.string().trim().min(1),
  contact_name: optional,
  phone: optional,
  email: optional.refine((v) => v === null || /^[^\s@]+@[^\s@]+$/.test(v), "Give an email address, or leave it blank."),
  address: optional,
  faa_cert: optional,
  notes: optional,
});

function parseVendor(formData: FormData): { ok: true; vendor: MxVendorInput } | { ok: false; state: VendorFormState } {
  const parsed = VendorSchema.safeParse(Object.fromEntries(formData.entries()));
  if (parsed.success) return { ok: true, vendor: parsed.data };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    errors[String(issue.path[0] ?? "form")] ??= issue.message;
  }
  return { ok: false, state: { status: "field-errors", errors } };
}

export async function createVendorAction(_prev: VendorFormState, formData: FormData): Promise<VendorFormState> {
  const parsed = parseVendor(formData);
  if (!parsed.ok) return parsed.state;
  try {
    await createVendor(parsed.vendor);
  } catch (err) {
    return { status: "api-error", message: refusal(err, "add the vendor") };
  }
  revalidatePath("/maintenance/vendors");
  redirect("/maintenance/vendors");
}

export async function updateVendorAction(
  id: string,
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  const parsed = parseVendor(formData);
  if (!parsed.ok) return parsed.state;
  try {
    await updateVendor(id, parsed.vendor);
  } catch (err) {
    return { status: "api-error", message: refusal(err, "save the vendor") };
  }
  revalidatePath("/maintenance/vendors");
  redirect("/maintenance/vendors");
}

export async function removeVendorAction(id: string): Promise<{ ok: false; message: string } | undefined> {
  try {
    await removeVendor(id);
  } catch (err) {
    return { ok: false, message: refusal(err, "remove the vendor") };
  }
  revalidatePath("/maintenance/vendors");
  redirect("/maintenance/vendors");
}
