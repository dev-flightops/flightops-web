"use server";

import { resolveSsoForEmail } from "@/lib/api/auth";
import type { SsoResolveResponse } from "@/lib/api/types";

/**
 * Server action wrapper for the public /auth/sso/resolve endpoint
 * (M2 SSO end-to-end). Called by the login form as the user types
 * their email, so we can swap the env-driven SSO buttons for the
 * tenant-specific list with per-tenant display_name overrides.
 *
 * Goes through a server action (not direct client fetch) so we don't
 * have to ship CORS config for the unauth path — same network model
 * the rest of the app uses.
 */
export async function resolveSsoAction(
  email: string,
): Promise<SsoResolveResponse> {
  if (!email || email.length < 3 || !email.includes("@")) {
    return { tenant_id: null, providers: [] };
  }
  return resolveSsoForEmail(email);
}
