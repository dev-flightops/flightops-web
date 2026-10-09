/**
 * Platform administrator session (#63), separate from Auth.js.
 *
 * A platform admin creates and suspends operator companies. They belong
 * to no operator (Greg, 9 Oct: "a separate platform login"), so they sign
 * in at /platform/login and their token lives in its own httpOnly cookie,
 * as the fuel supplier portal's does. The name differs from both the
 * Auth.js cookie and the supplier's, so the sessions never cross.
 */

import { cookies } from "next/headers";

const COOKIE_NAME = "platform_session";
// The token's own lifetime (JWT_ACCESS_TTL_SECONDS, an hour). There is
// no refresh: an hour after signing in, sign in again.
const COOKIE_MAX_AGE_SECONDS = 60 * 60;

export interface PlatformSession {
  access_token: string;
  admin_id: string;
  full_name: string;
  email: string;
  /** Unix seconds, the token's exp. */
  expires_at: number;
}

export async function setPlatformSession(input: Omit<PlatformSession, "expires_at"> & { expires_in: number }) {
  const session: PlatformSession = {
    access_token: input.access_token,
    admin_id: input.admin_id,
    full_name: input.full_name,
    email: input.email,
    expires_at: Math.floor(Date.now() / 1000) + input.expires_in,
  };
  const jar = await cookies();
  jar.set({
    name: COOKIE_NAME,
    value: JSON.stringify(session),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/** The current session, or null when there is none or it has expired. */
export async function getPlatformSession(): Promise<PlatformSession | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PlatformSession;
    if (typeof parsed.access_token !== "string" || typeof parsed.expires_at !== "number") return null;
    if (parsed.expires_at * 1000 <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPlatformSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
