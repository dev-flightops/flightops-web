/**
 * Typed wrappers around auth-service endpoints that the frontend calls
 * after login (login itself runs through Auth.js, not these helpers).
 */

import { apiFetch } from "./client";
import type {
  CompanyBaseCreateRequest,
  CompanyBaseListResponse,
  CompanyBaseResponse,
  CompanyBaseUpdateRequest,
  CompanyProfileResponse,
  CompanyProfileUpdateRequest,
  FlightTrackingConfigResponse,
  FlightTrackingConfigUpdateRequest,
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
 *
 * Failure modes are *all* treated as "no SSO providers available" rather
 * than thrown errors, because this gets invoked during the login page's
 * server-render — including Vercel's build-time pre-render where the
 * backend is unreachable. The credentials form still works in every case;
 * SSO buttons are additive, so a soft failure here loses nothing.
 */
export async function fetchEnabledProviders(): Promise<ProvidersResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    // No backend URL configured — most common during Vercel Preview builds
    // when env vars aren't propagated to the Preview environment yet.
    return { providers: [] };
  }
  try {
    const response = await fetch(`${apiUrl}/auth/providers`, {
      cache: "no-store",
    });
    if (!response.ok) return { providers: [] };
    return (await response.json()) as ProvidersResponse;
  } catch {
    // DNS failure, network blip, tunnel down — hide SSO and move on.
    return { providers: [] };
  }
}

// ---- Settings (M2-M-28a) ----

export async function getCompanyProfile(): Promise<CompanyProfileResponse> {
  return apiFetch<CompanyProfileResponse>("/auth/settings/company");
}

export async function updateCompanyProfile(
  body: CompanyProfileUpdateRequest,
): Promise<CompanyProfileResponse> {
  return apiFetch<CompanyProfileResponse>("/auth/settings/company", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function listCompanyBases(
  options: { includeInactive?: boolean } = {},
): Promise<CompanyBaseListResponse> {
  const qs = options.includeInactive ? "?include_inactive=true" : "";
  return apiFetch<CompanyBaseListResponse>(`/auth/settings/bases${qs}`);
}

export async function createCompanyBase(
  body: CompanyBaseCreateRequest,
): Promise<CompanyBaseResponse> {
  return apiFetch<CompanyBaseResponse>("/auth/settings/bases", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateCompanyBase(
  baseId: string,
  body: CompanyBaseUpdateRequest,
): Promise<CompanyBaseResponse> {
  return apiFetch<CompanyBaseResponse>(`/auth/settings/bases/${baseId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deactivateCompanyBase(baseId: string): Promise<void> {
  await apiFetch<void>(`/auth/settings/bases/${baseId}`, {
    method: "DELETE",
  });
}

export async function getFlightTrackingConfig(): Promise<FlightTrackingConfigResponse> {
  return apiFetch<FlightTrackingConfigResponse>(
    "/auth/settings/flight-tracking",
  );
}

export async function updateFlightTrackingConfig(
  body: FlightTrackingConfigUpdateRequest,
): Promise<FlightTrackingConfigResponse> {
  return apiFetch<FlightTrackingConfigResponse>(
    "/auth/settings/flight-tracking",
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}
