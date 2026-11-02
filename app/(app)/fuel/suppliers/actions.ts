"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { addSupplierLogin, setSupplierLoginActive, setSupplierLoginPassword } from "@/lib/api/auth";
import { refusalText } from "@/lib/api/validation-errors";

/**
 * A fuel supplier's portal logins (#134): add one, switch it off and on,
 * give it a new password. Kept by the fuel directory's keepers (FUEL_CONFIG);
 * the auth service checks that too.
 */

export interface SupplierLoginResult {
  ok: boolean;
  /** What to tell the person who added it. */
  message?: string;
  error?: string;
}

function refused(err: unknown, fallback: string): SupplierLoginResult {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return { ok: false, error: "Only the Chief Pilot, the Director of Maintenance, the Director of Operations or an Exec Admin can change a supplier's logins." };
    }
    try {
      const message = JSON.parse(err.message)?.detail?.message;
      if (typeof message === "string") return { ok: false, error: message };
    } catch {
      // not JSON: try the field reader below
    }
    const text = refusalText(err);
    if (text) return { ok: false, error: text };
  }
  return { ok: false, error: fallback };
}

export async function addSupplierLoginAction(
  supplierId: string,
  form: { full_name: string; email: string; password: string },
): Promise<SupplierLoginResult> {
  const fullName = form.full_name.trim();
  const email = form.email.trim();
  if (!fullName || !/.+@.+/.test(email)) return { ok: false, error: "Give their name and email." };
  if (form.password && form.password.length < 8) return { ok: false, error: "The password needs at least 8 characters." };
  try {
    const login = await addSupplierLogin(supplierId, { full_name: fullName, email, password: form.password || null });
    revalidatePath("/fuel/suppliers");
    return {
      ok: true,
      message: login.existing_account
        ? `${login.full_name} already had a supplier login: they sign in at /fuel-supplier/login with their own password, and now see your orders too.`
        : `${login.full_name} can sign in at /fuel-supplier/login with ${login.email} and that password.`,
    };
  } catch (err) {
    return refused(err, "Couldn't add the login. Try again in a moment.");
  }
}

export async function setSupplierLoginActiveAction(
  supplierId: string,
  loginId: string,
  active: boolean,
): Promise<SupplierLoginResult> {
  try {
    await setSupplierLoginActive(supplierId, loginId, active);
    revalidatePath("/fuel/suppliers");
    return { ok: true };
  } catch (err) {
    return refused(err, active ? "Couldn't switch the login back on." : "Couldn't switch the login off.");
  }
}

export async function setSupplierLoginPasswordAction(
  supplierId: string,
  loginId: string,
  password: string,
): Promise<SupplierLoginResult> {
  if (password.length < 8) return { ok: false, error: "The password needs at least 8 characters." };
  try {
    await setSupplierLoginPassword(supplierId, loginId, password);
    return { ok: true, message: "Password changed. Tell them the new one." };
  } catch (err) {
    return refused(err, "Couldn't change the password.");
  }
}
