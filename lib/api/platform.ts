/**
 * Platform administrator API (#63): sign-in and password at the auth
 * service, companies at the admin service. Server-only.
 *
 * Calls carry the platform session's token, not the Auth.js one: the
 * operator services refuse a platform token, and the admin service
 * refuses every other kind. Each call returns a tagged result, so a page
 * can tell "wrong password" or "name taken" from "server unreachable"
 * without catching.
 */

import { getPlatformSession } from "./platform-session";

const apiBaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL not configured");
  return url;
};

export type PlatformResult<T> =
  | { ok: true; body: T }
  | { ok: false; status: number; detail: string; retryAfter?: string | null };

export interface PlatformLoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  admin_id: string;
  full_name: string;
  email: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  /** Active staff logins. */
  staff: number;
}

export interface CompanyCreated {
  company: Company;
  admin_email: string;
  one_time_password: string;
}

export interface CompanyInput {
  name: string;
  slug: string | null;
  admin_email: string;
  admin_name: string;
}

async function call<T>(path: string, init: RequestInit & { token?: string }): Promise<PlatformResult<T>> {
  const { token, ...rest } = init;
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });
    if (!response.ok) {
      let detail = response.statusText;
      try {
        const body = await response.json();
        if (typeof body?.detail === "string") detail = body.detail;
      } catch {
        /* not JSON */
      }
      return { ok: false, status: response.status, detail, retryAfter: response.headers.get("retry-after") };
    }
    const body = response.status === 204 ? (undefined as T) : ((await response.json()) as T);
    return { ok: true, body };
  } catch (err) {
    return { ok: false, status: 0, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** The session's token, or a 401 result when signed out. */
async function token(): Promise<string | null> {
  return (await getPlatformSession())?.access_token ?? null;
}

const SIGNED_OUT = { ok: false, status: 401, detail: "signed_out" } as const;

export function loginPlatformAdmin(email: string, password: string) {
  return call<PlatformLoginResponse>("/auth/platform/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function changePlatformPassword(currentPassword: string, newPassword: string) {
  const t = await token();
  if (!t) return SIGNED_OUT;
  return call<void>("/auth/platform/password", {
    method: "POST",
    token: t,
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

/** Revoke the token at sign-out, as staff sign-out does. */
export async function logoutPlatformAdmin() {
  const t = await token();
  if (!t) return SIGNED_OUT;
  return call<unknown>("/auth/logout", { method: "POST", token: t });
}

export async function listCompanies() {
  const t = await token();
  if (!t) return SIGNED_OUT;
  return call<{ items: Company[] }>("/admin/companies", { method: "GET", token: t });
}

export async function createCompany(input: CompanyInput) {
  const t = await token();
  if (!t) return SIGNED_OUT;
  return call<CompanyCreated>("/admin/companies", { method: "POST", token: t, body: JSON.stringify(input) });
}

export async function setCompanyActive(companyId: string, active: boolean) {
  const t = await token();
  if (!t) return SIGNED_OUT;
  const action = active ? "reactivate" : "suspend";
  return call<Company>(`/admin/companies/${encodeURIComponent(companyId)}/${action}`, { method: "POST", token: t });
}
