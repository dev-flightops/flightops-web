/**
 * Typed wrappers around auth-service endpoints that the frontend calls
 * after login (login itself runs through Auth.js, not these helpers).
 */

import { apiFetch } from "./client";
import type {
  ProvidersResponse,
  SwitchTenantResponse,
  TenantsResponse,
} from "./types";

export async function listMyTenants(): Promise<TenantsResponse> {
  return apiFetch<TenantsResponse>("/auth/me/tenants");
}

export async function switchTenant(
  tenantId: string,
): Promise<SwitchTenantResponse> {
  return apiFetch<SwitchTenantResponse>(`/auth/switch-tenant/${tenantId}`, {
    method: "POST",
  });
}

/**
 * Unauthenticated — the login page calls this directly (no session yet).
 * Returns the SSO providers whose credentials are set on the backend, so
 * the UI only renders buttons for flows that will actually work.
 */
export async function fetchEnabledProviders(): Promise<ProvidersResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL not configured");
  const response = await fetch(`${apiUrl}/auth/providers`, {
    cache: "no-store",
  });
  if (!response.ok) {
    // Don't block the login page if the auth-service hiccups — just hide
    // the SSO buttons. The credentials form still works.
    return { providers: [] };
  }
  return (await response.json()) as ProvidersResponse;
}
