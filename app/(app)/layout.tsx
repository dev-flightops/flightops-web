import { auth, signOut } from "@/auth";
import { AppShell } from "@/components/app-shell/app-shell";
import { HeaderActions } from "@/components/app-shell/header-actions";
import { BrandThemeStyle } from "@/components/app-shell/brand-theme-style";
import { SafetyReportButton } from "@/components/safety/safety-report-button";
import { getCompanyProfile, listMyTenants } from "@/lib/api/auth";
import { SessionExpiredError } from "@/lib/api/client";
import { getCurrentDuty } from "@/lib/api/ops";
import type { CurrentDutyResponse } from "@/lib/api/types";
import { TenantProvider } from "@/lib/tenant";

import { signOutAction, switchTenantAction } from "./actions";

/**
 * Layout for the (app) route group — wraps every in-app page (home,
 * dispatch, dashboards) with the AppShell chrome and a TenantProvider
 * seeded from the backend.
 *
 * The TenantProvider stays in place even though we no longer render a
 * visible tenant switcher in the header (the legacy header doesn't have
 * one). Multi-tenant switching will live in Settings (M4); the provider
 * still feeds the current-tenant data to anything downstream that needs
 * it.
 */
export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let tenants;
  try {
    const response = await listMyTenants();
    tenants = response.tenants;
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      // Bare redirect("/login") is not enough here: the Auth.js session
      // cookie is signed with AUTH_SECRET and stays "valid" independent
      // of the FlightOps JWT. If we redirect to /login while the
      // session cookie is still present, proxy.ts treats the user as
      // logged-in and bounces them back to /home/ → another 401 → loop.
      // signOut() clears the Auth.js cookie too so /login renders for
      // real. Triggered by: re-seeding the DB (user UUIDs change),
      // backend JWT key rotation, user/tenant deletion. JWT TTL expiry
      // is handled separately by the jwt callback in auth.ts.
      await signOut({ redirectTo: "/login" });
    }
    throw error;
  }

  const session = await auth();
  const currentTenant = tenants.find((t) => t.is_current) ?? tenants[0];
  const brand = currentTenant?.name ?? "Peregrine Flight Ops";

  // Per-tenant brand color overrides (M3 branding). Fetched here so every
  // authenticated page inherits the tenant theme without each route
  // re-fetching. Soft-fails to defaults if the auth service is briefly
  // unreachable — the app still renders with platform colors.
  let brandTheme: {
    brand_primary_color: string | null;
    brand_primary_dark_color: string | null;
  } = { brand_primary_color: null, brand_primary_dark_color: null };
  try {
    const profile = await getCompanyProfile();
    brandTheme = {
      brand_primary_color: profile.brand_primary_color,
      brand_primary_dark_color: profile.brand_primary_dark_color,
    };
  } catch {
    // Non-fatal: fall through to defaults.
  }

  // Pilot duty state seeds the top-bar Clock In/Out pill. Soft-fails so
  // brief ops-service blips don't break every in-app page — the pill
  // just falls back to its disabled placeholder in that case.
  let initialDuty: CurrentDutyResponse | null = null;
  try {
    initialDuty = await getCurrentDuty();
  } catch {
    initialDuty = null;
  }

  const actionsSlot = session?.user?.email ? (
    <HeaderActions
      email={session.user.email}
      fullName={session.user.name ?? null}
      signOutAction={signOutAction}
      initialDuty={initialDuty}
    />
  ) : null;

  return (
    <TenantProvider
      tenants={tenants}
      switchTenantAction={switchTenantAction}
    >
      <BrandThemeStyle
        primary={brandTheme.brand_primary_color}
        primaryDark={brandTheme.brand_primary_dark_color}
      />
      <AppShell brand={brand} actionsSlot={actionsSlot}>
        {children}
        {/* Spec: global Safety Report button, fixed bottom-right on every
            page. Mounted at the layout so it survives client-side
            navigation between routes inside the (app) group. */}
        <SafetyReportButton />
      </AppShell>
    </TenantProvider>
  );
}
