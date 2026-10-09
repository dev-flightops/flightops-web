"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { lockoutMinutes, tooManyAttemptsMessage } from "@/lib/login-errors";
import { loginPlatformAdmin } from "@/lib/api/platform";
import { setPlatformSession } from "@/lib/api/platform-session";

const LoginSchema = z.object({
  email: z.string().trim().min(3, "Enter your email.").max(320).regex(/.+@.+/, "Enter your email."),
  password: z.string().min(1, "Enter your password.").max(200),
});

export type PlatformLoginState = { status: "idle" } | { status: "error"; message: string; email: string };

/** Sign a platform administrator in (#63) and open the companies page. */
export async function platformLoginAction(_prev: PlatformLoginState, formData: FormData): Promise<PlatformLoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = LoginSchema.safeParse({ email, password: formData.get("password") ?? "" });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the fields.", email };

  const result = await loginPlatformAdmin(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    if (result.status === 429) {
      return { status: "error", message: tooManyAttemptsMessage(lockoutMinutes(result.retryAfter)), email };
    }
    if (result.status === 401 || result.status === 422) {
      return { status: "error", message: "Wrong email or password.", email };
    }
    return { status: "error", message: "Couldn't reach the sign-in service. Try again in a moment.", email };
  }
  const body = result.body;
  await setPlatformSession({
    access_token: body.access_token,
    admin_id: body.admin_id,
    full_name: body.full_name,
    email: body.email,
    expires_in: body.expires_in,
  });
  redirect("/platform");
}
