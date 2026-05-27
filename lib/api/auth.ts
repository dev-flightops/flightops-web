/**
 * Typed wrappers around auth-service endpoints that the frontend calls
 * after login (login itself runs through Auth.js, not these helpers).
 */

import { apiFetch } from "./client";
import type { SwitchTenantResponse, TenantsResponse } from "./types";

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
