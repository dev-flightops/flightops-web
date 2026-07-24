/**
 * Typed wrappers around auth-service endpoints that the frontend calls
 * after login (login itself runs through Auth.js, not these helpers).
 */

import { apiFetch } from "./client";
import type {
  AdminAccessRoleRow,
  AdminAccessRolesResponse,
  AdminAccessToggleRequest,
  CompanyBaseCreateRequest,
  CompanyBaseListResponse,
  CompanyBaseResponse,
  CompanyBaseUpdateRequest,
  CompanyProfileResponse,
  CompanyProfileUpdateRequest,
  FlightTrackingConfigResponse,
  FlightTrackingConfigUpdateRequest,
  ProviderCatalogResponse,
  ProvidersResponse,
  RolesResponse,
  SsoProviderId,
  SsoResolveResponse,
  SwitchTenantResponse,
  TenantSsoProviderListResponse,
  TenantSsoProviderResponse,
  TenantSsoProviderUpsertRequest,
  TenantsResponse,
  UserCreateRequest,
  UserListResponse,
  UserResponse,
  UserSetPasswordRequest,
  UserUpdateRequest,
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

/**
 * Email-first SSO resolution (M2 — SSO end-to-end).
 *
 * Unauthenticated — the login page calls this AFTER the user enters
 * their email but BEFORE they pick a sign-in method. Returns the
 * tenant's active SSO providers (with per-tenant display_name
 * overrides) so the UI can render the right buttons.
 *
 * Same soft-failure contract as fetchEnabledProviders: any backend
 * error returns an empty response so the credentials form keeps
 * working. The backend also never throws on unknown emails — it
 * returns the same fixed empty shape — so we don't need to special-
 * case missing tenants here.
 */
export async function resolveSsoForEmail(
  email: string,
): Promise<SsoResolveResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const empty: SsoResolveResponse = { tenant_id: null, providers: [] };
  if (!apiUrl) return empty;
  try {
    const response = await fetch(
      `${apiUrl}/auth/sso/resolve?email=${encodeURIComponent(email)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return empty;
    return (await response.json()) as SsoResolveResponse;
  } catch {
    return empty;
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

// ---- Operating Costs (M2 tail) ----
// All four resources under /auth/settings/costs.

export interface AircraftCostRow {
  id: string;
  aircraft_type: string;
  fuel_burn_gph: string | null;
  engine_reserve_hr: string | null;
  prop_reserve_hr: string | null;
  maintenance_hr: string | null;
  oil_consumables_hr: string | null;
  pilot_daily_rate: string | null;
  avg_duty_hrs: string | null;
  insurance_hr: string | null;
}

export interface FuelPriceRow {
  id: string;
  icao_code: string;
  price_per_gal: string;
  fuel_type: string;
}

export interface LandingFeeRow {
  id: string;
  icao_code: string;
  fee_amount: string;
  notes: string | null;
}

export interface RouteFlightTimeRow {
  id: string;
  origin_icao: string;
  dest_icao: string;
  est_flight_hrs: string;
}

export interface OperatingCostsResponse {
  aircraft_costs: AircraftCostRow[];
  fuel_prices: FuelPriceRow[];
  landing_fees: LandingFeeRow[];
  routes: RouteFlightTimeRow[];
}

export async function getOperatingCosts(): Promise<OperatingCostsResponse> {
  return apiFetch<OperatingCostsResponse>("/auth/settings/costs");
}

// Upserts + deletes reuse the same endpoints legacy defined at
// /settings/costs/{aircraft-type,fuel-price,landing-fee,route}.
// Not wired to UI yet — the Add/Edit dialogs land in a follow-up.

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

// ---- Users + Permissions (M2-M-28b) ----

export async function listUsers(): Promise<UserListResponse> {
  return apiFetch<UserListResponse>("/auth/settings/users");
}

export async function createUser(
  body: UserCreateRequest,
): Promise<UserResponse> {
  return apiFetch<UserResponse>("/auth/settings/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateUser(
  userId: string,
  body: UserUpdateRequest,
): Promise<UserResponse> {
  return apiFetch<UserResponse>(`/auth/settings/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function setUserPassword(
  userId: string,
  body: UserSetPasswordRequest,
): Promise<UserResponse> {
  return apiFetch<UserResponse>(`/auth/settings/users/${userId}/password`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deactivateUser(userId: string): Promise<void> {
  await apiFetch<void>(`/auth/settings/users/${userId}`, {
    method: "DELETE",
  });
}

export async function listRoles(): Promise<RolesResponse> {
  return apiFetch<RolesResponse>("/auth/settings/roles");
}

// ---- Admin Access toggle per role (M2-X-1) ----

export async function listAdminAccess(): Promise<AdminAccessRolesResponse> {
  return apiFetch<AdminAccessRolesResponse>("/auth/settings/admin-access");
}

export async function setAdminAccess(
  role: string,
  body: AdminAccessToggleRequest,
): Promise<AdminAccessRoleRow> {
  return apiFetch<AdminAccessRoleRow>(
    `/auth/settings/admin-access/${role}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

// ---- Per-tenant SSO providers (M2-M-28c) ----

export async function getSsoCatalog(): Promise<ProviderCatalogResponse> {
  return apiFetch<ProviderCatalogResponse>("/auth/settings/sso/catalog");
}

export async function listSsoProviders(): Promise<TenantSsoProviderListResponse> {
  return apiFetch<TenantSsoProviderListResponse>(
    "/auth/settings/sso/providers",
  );
}

export async function upsertSsoProvider(
  providerId: SsoProviderId,
  body: TenantSsoProviderUpsertRequest,
): Promise<TenantSsoProviderResponse> {
  return apiFetch<TenantSsoProviderResponse>(
    `/auth/settings/sso/providers/${providerId}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export async function deleteSsoProvider(
  providerId: SsoProviderId,
): Promise<void> {
  await apiFetch<void>(`/auth/settings/sso/providers/${providerId}`, {
    method: "DELETE",
  });
}
