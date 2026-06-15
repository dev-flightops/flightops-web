"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createCompanyBase,
  deactivateCompanyBase,
  updateCompanyBase,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/**
 * /settings/bases server actions. Three actions cover the CRUD set:
 * createBaseAction (with ICAO uniqueness handling), updateBaseAction
 * (partial edit), and deactivateBaseAction (soft-delete).
 */

export type BasesActionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

const nullableTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const BaseSchema = z.object({
  icao: z
    .string()
    .trim()
    .min(2, "ICAO must be 2-10 characters")
    .max(10)
    .transform((v) => v.toUpperCase()),
  display_name: z.string().trim().min(1, "Name is required").max(200),
  city: nullableTrimmed(100),
  state: nullableTrimmed(100),
  timezone: nullableTrimmed(60),
  is_hub: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
    .transform((v) => v === "on" || v === "true"),
  manager_name: nullableTrimmed(200),
  manager_phone: nullableTrimmed(50),
  manager_email: nullableTrimmed(200),
  notes: z
    .string()
    .max(5000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

function _formatErrors(parsed: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of parsed.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

function _apiErrorState(err: unknown, action: string): BasesActionState {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return {
        status: "api-error",
        message: "Your session expired — please sign in again.",
      };
    }
    if (err.status === 409) {
      return {
        status: "field-errors",
        errors: { icao: "That ICAO already exists in this tenant." },
      };
    }
    return {
      status: "api-error",
      message: `Couldn't ${action} (HTTP ${err.status}). Try again in a moment.`,
    };
  }
  return {
    status: "api-error",
    message: `Couldn't ${action}. Try again in a moment.`,
  };
}

export async function createBaseAction(
  _prev: BasesActionState,
  formData: FormData,
): Promise<BasesActionState> {
  const parsed = BaseSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "field-errors", errors: _formatErrors(parsed.error) };
  }
  try {
    await createCompanyBase(parsed.data);
  } catch (err) {
    return _apiErrorState(err, "add the base");
  }
  revalidatePath("/settings/bases");
  revalidatePath("/settings");
  return { status: "ok" };
}

export async function updateBaseAction(
  _prev: BasesActionState,
  formData: FormData,
): Promise<BasesActionState> {
  const baseId = String(formData.get("base_id") ?? "");
  if (!baseId) {
    return {
      status: "api-error",
      message: "Missing base id — refresh and try again.",
    };
  }
  // Edit form omits ICAO (immutable post-create); accept the rest.
  const parsed = BaseSchema.omit({ icao: true }).safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { status: "field-errors", errors: _formatErrors(parsed.error) };
  }
  try {
    await updateCompanyBase(baseId, parsed.data);
  } catch (err) {
    return _apiErrorState(err, "save the base");
  }
  revalidatePath("/settings/bases");
  return { status: "ok" };
}

export async function deactivateBaseAction(
  _prev: BasesActionState,
  formData: FormData,
): Promise<BasesActionState> {
  const baseId = String(formData.get("base_id") ?? "");
  if (!baseId) {
    return {
      status: "api-error",
      message: "Missing base id — refresh and try again.",
    };
  }
  try {
    await deactivateCompanyBase(baseId);
  } catch (err) {
    return _apiErrorState(err, "deactivate the base");
  }
  revalidatePath("/settings/bases");
  revalidatePath("/settings");
  return { status: "ok" };
}
