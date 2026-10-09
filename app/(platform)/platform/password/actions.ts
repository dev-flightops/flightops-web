"use server";

import { redirect } from "next/navigation";

import { changePlatformPassword } from "@/lib/api/platform";
import { clearPlatformSession } from "@/lib/api/platform-session";

export interface PasswordState {
  status: "idle" | "ok" | "error";
  message?: string;
  attempt: number;
}

/** The auth service's floor for a platform password. */
const MIN_LENGTH = 12;

/** Change your own platform password (#63). The first one is one-time. */
export async function changePasswordAction(prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const attempt = prev.attempt + 1;
  const fail = (message: string): PasswordState => ({ status: "error", message, attempt });
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const again = String(formData.get("confirm_password") ?? "");

  if (!current) return fail("Enter your current password.");
  if (next.length < MIN_LENGTH) return fail(`The new password needs at least ${MIN_LENGTH} characters.`);
  if (next !== again) return fail("The new passwords don't match.");

  const result = await changePlatformPassword(current, next);
  if (!result.ok) {
    if (result.status === 401) {
      await clearPlatformSession();
      redirect("/platform/login");
    }
    if (result.detail === "current_password_incorrect") return fail("Your current password is wrong.");
    if (result.detail === "password_unchanged") return fail("Choose a password you haven't been using.");
    if (result.status === 0) return fail("Couldn't reach the server. Try again in a moment.");
    return fail(`The password was not changed (HTTP ${result.status}).`);
  }
  return { status: "ok", message: "Password changed.", attempt };
}
