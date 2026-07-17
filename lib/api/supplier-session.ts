/**
 * M3-X-2 web — fuel-supplier portal session, separate from Auth.js.
 *
 * The supplier portal at /fuel-supplier/* is a distinct user surface
 * — external fuel-company employees who serve orders across one or
 * more tenants. Rather than shoehorn them into the tenant-user
 * Auth.js flow, they get their own httpOnly cookie holding the
 * supplier JWT minted by POST /auth/fuel-supplier/login.
 *
 * The cookie name (fuel_supplier_session) is deliberately distinct
 * from the Auth.js cookie so a supplier who happens to also be a
 * tenant user on the same browser doesn't accidentally cross
 * sessions. Both cookies can coexist.
 */

import { cookies } from "next/headers";

const COOKIE_NAME = "fuel_supplier_session";
// 1h to match the JWT expiry (JWT_ACCESS_TTL_SECONDS default).
// Cookie clears on logout via clearSupplierSession().
const COOKIE_MAX_AGE_SECONDS = 60 * 60;

export interface SupplierBinding {
  tenant_id: string;
  fuel_supplier_id: string;
}

export interface SupplierSession {
  access_token: string;
  account_id: string;
  full_name: string;
  email: string;
  bindings: SupplierBinding[];
  /** Unix seconds — JWT exp. Used to fail fast on stale sessions
   *  without a backend round-trip. */
  expires_at: number;
}

export interface SetSupplierSessionInput {
  access_token: string;
  account_id: string;
  full_name: string;
  email: string;
  bindings: SupplierBinding[];
  expires_in: number; // seconds
}

/** Called from the login server action after a successful backend
 *  POST /auth/fuel-supplier/login. Persists the session to an
 *  httpOnly cookie the middleware can read. */
export async function setSupplierSession(
  input: SetSupplierSessionInput,
): Promise<void> {
  const session: SupplierSession = {
    access_token: input.access_token,
    account_id: input.account_id,
    full_name: input.full_name,
    email: input.email,
    bindings: input.bindings,
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

/** Read the current supplier session. Returns null if unset or if
 *  the JWT expiry has passed (fail-fast). */
export async function getSupplierSession(): Promise<SupplierSession | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SupplierSession;
    if (
      typeof parsed.access_token !== "string" ||
      typeof parsed.expires_at !== "number" ||
      !Array.isArray(parsed.bindings)
    ) {
      return null;
    }
    if (parsed.expires_at * 1000 <= Date.now()) {
      // Expired — treat as if not set. The route can redirect to
      // /fuel-supplier/login.
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSupplierSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
