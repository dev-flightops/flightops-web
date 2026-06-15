"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { updateCompanyProfile } from "@/lib/api/auth";

/**
 * /settings/company server action. Validates with zod, PATCHes auth-service,
 * revalidates the page on success.
 *
 * PATCH semantics: every column is optional and empty strings are coerced to
 * null so a cleared field actually clears the row (instead of being saved as
 * "").
 */

const nullableTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const Schema = z.object({
  legal_name: nullableTrimmed(300),
  short_name: nullableTrimmed(100),
  logo_url: nullableTrimmed(500),
  street_line_1: nullableTrimmed(200),
  street_line_2: nullableTrimmed(200),
  city: nullableTrimmed(100),
  state: nullableTrimmed(100),
  postal_code: nullableTrimmed(20),
  country: nullableTrimmed(100),
  main_phone: nullableTrimmed(50),
  ops_phone: nullableTrimmed(50),
  main_email: nullableTrimmed(200),
  ops_email: nullableTrimmed(200),
  part_135_certificate: nullableTrimmed(50),
  fiscal_year_end: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .refine(
      (v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v),
      "Use yyyy-mm-dd",
    ),
  notes: z
    .string()
    .max(5000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export type UpdateCompanyState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export async function updateCompanyAction(
  _prev: UpdateCompanyState,
  formData: FormData,
): Promise<UpdateCompanyState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "field-errors", errors };
  }

  try {
    await updateCompanyProfile(parsed.data);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "api-error",
          message: "Your session expired — please sign in again.",
        };
      }
      return {
        status: "api-error",
        message: `Couldn't save (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return {
      status: "api-error",
      message: "Couldn't save. Try again in a moment.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/settings/company");
  return { status: "saved" };
}
