"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createCompany, logoutPlatformAdmin, setCompanyActive } from "@/lib/api/platform";
import { clearPlatformSession } from "@/lib/api/platform-session";

export interface CreateCompanyState {
  status: "idle" | "ok" | "error";
  message?: string;
  /** What was sent, so a refused company is shown again as typed. */
  values?: Record<string, string>;
  /** Shown once, in the page that made it. */
  created?: { name: string; admin_email: string; one_time_password: string };
  attempt: number;
}

export interface CompanyStatusState {
  status: "idle" | "ok" | "error";
  message?: string;
  attempt: number;
}

const _schema = z.object({
  name: z.string().trim().min(2, "Enter the company's name.").max(120, "Keep the name under 120 characters."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(60, "Keep the short name under 60 characters.")
    .regex(/^([a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?)?$/, "The short name takes lowercase letters, digits and hyphens."),
  admin_email: z.string().trim().toLowerCase().regex(/^[^@\s]+@[^@\s]+$/, "Enter the Exec Admin's email."),
  admin_name: z.string().trim().min(1, "Enter the Exec Admin's name.").max(120),
});

const FIELDS = ["name", "slug", "admin_email", "admin_name"] as const;

/** A 401 means the hour-long platform session has ended: sign in again. */
async function signedOut(): Promise<never> {
  await clearPlatformSession();
  redirect("/platform/login");
}

/** Create a company and its first Exec Admin (#63). */
export async function createCompanyAction(prev: CreateCompanyState, formData: FormData): Promise<CreateCompanyState> {
  const values: Record<string, string> = {};
  for (const key of FIELDS) values[key] = String(formData.get(key) ?? "");
  const attempt = prev.attempt + 1;
  const fail = (message: string): CreateCompanyState => ({ status: "error", message, values, attempt });

  const parsed = _schema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the fields and try again.");
  const v = parsed.data;

  const result = await createCompany({
    name: v.name,
    slug: v.slug || null,
    admin_email: v.admin_email,
    admin_name: v.admin_name,
  });
  if (!result.ok) {
    if (result.status === 401) return signedOut();
    if (result.status === 409) return fail("A company with that name or short name already exists.");
    if (result.status === 422) return fail("Check the short name: lowercase letters, digits and hyphens.");
    if (result.status === 403) return fail("Only platform administrators can create companies.");
    if (result.status === 0) return fail("Couldn't reach the server. Try again in a moment.");
    return fail(`The company was not created (HTTP ${result.status}).`);
  }
  revalidatePath("/platform");
  return {
    status: "ok",
    created: {
      name: result.body.company.name,
      admin_email: result.body.admin_email,
      one_time_password: result.body.one_time_password,
    },
    attempt,
  };
}

/** Suspend or reactivate a company (#63). */
export async function setCompanyActiveAction(prev: CompanyStatusState, formData: FormData): Promise<CompanyStatusState> {
  const attempt = prev.attempt + 1;
  const companyId = z.string().uuid().safeParse(formData.get("company_id"));
  const active = formData.get("active") === "true";
  if (!companyId.success) return { status: "error", message: "Refresh the page and try again.", attempt };

  const result = await setCompanyActive(companyId.data, active);
  if (!result.ok) {
    if (result.status === 401) return signedOut();
    if (result.status === 404) return { status: "error", message: "That company no longer exists.", attempt };
    return { status: "error", message: `That didn't work (HTTP ${result.status}).`, attempt };
  }
  revalidatePath("/platform");
  return { status: "ok", attempt };
}

/** Sign out: revoke the token, then drop the cookie. */
export async function platformLogoutAction(): Promise<void> {
  await logoutPlatformAdmin();
  await clearPlatformSession();
  redirect("/platform/login");
}
