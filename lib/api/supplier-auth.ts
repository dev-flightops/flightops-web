/**
 * M3-X-2 — public wrappers around POST /auth/fuel-supplier/login.
 *
 * Login is unauthenticated (that's the whole point) so this hits
 * the backend directly rather than routing through supplierApiFetch.
 */

import type { SupplierBinding } from "./supplier-session";

const apiBaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL not configured");
  return url;
};

export interface SupplierLoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  account_id: string;
  full_name: string;
  email: string;
  bindings: SupplierBinding[];
}

export type SupplierLoginResult =
  | { ok: true; body: SupplierLoginResponse }
  | { ok: false; status: number; detail: string };

/** Server-only: POST /auth/fuel-supplier/login. Returns a tagged
 *  result so the caller can distinguish "wrong credentials" from
 *  "backend unreachable" without an exception dance. */
export async function loginSupplierAccount(
  email: string,
  password: string,
): Promise<SupplierLoginResult> {
  try {
    const response = await fetch(
      `${apiBaseUrl()}/auth/fuel-supplier/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      let detail = response.statusText;
      try {
        const body = await response.json();
        if (typeof body?.detail === "string") detail = body.detail;
      } catch {
        /* ignore */
      }
      return { ok: false, status: response.status, detail };
    }
    const body = (await response.json()) as SupplierLoginResponse;
    return { ok: true, body };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
