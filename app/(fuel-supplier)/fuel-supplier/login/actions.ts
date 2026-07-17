"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { loginSupplierAccount } from "@/lib/api/supplier-auth";
import { setSupplierSession } from "@/lib/api/supplier-session";

/**
 * M3-X-2 — /fuel-supplier/login server action.
 *
 * Success path: mint a supplier session cookie + redirect to
 * /fuel-supplier (the inbox). Failure path: return a state the form
 * renders inline (invalid credentials vs. backend unreachable) so
 * the login page doesn't need its own client-side fetch layer.
 */

const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3, "Email is required")
    .max(254)
    .regex(/.+@.+/, "Doesn't look like an email address"),
  password: z.string().min(1, "Password is required").max(200),
});

export type SupplierLoginState =
  | { status: "idle" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export async function supplierLoginAction(
  _prev: SupplierLoginState,
  formData: FormData,
): Promise<SupplierLoginState> {
  const parsed = LoginSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "field-errors", errors };
  }

  const result = await loginSupplierAccount(
    parsed.data.email,
    parsed.data.password,
  );
  if (!result.ok) {
    if (result.status === 401) {
      return {
        status: "api-error",
        message: "Invalid email or password.",
      };
    }
    if (result.status === 0) {
      return {
        status: "api-error",
        message: "Couldn't reach the login service. Try again in a moment.",
      };
    }
    return {
      status: "api-error",
      message: `Login failed (HTTP ${result.status}).`,
    };
  }

  await setSupplierSession({
    access_token: result.body.access_token,
    account_id: result.body.account_id,
    full_name: result.body.full_name,
    email: result.body.email,
    bindings: result.body.bindings,
    expires_in: result.body.expires_in,
  });

  redirect("/fuel-supplier");
}
