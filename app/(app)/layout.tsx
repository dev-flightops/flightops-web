import { auth, signOut } from "@/auth";
import { AppShell } from "@/components/app-shell/app-shell";
import { HeaderActions } from "@/components/app-shell/header-actions";
import { ExternalActions } from "@/components/app-shell/identity";
import { BrandThemeStyle } from "@/components/app-shell/brand-theme-style";
import { DatePickerAffordance } from "@/components/app-shell/date-picker-affordance";
import { rolesCanSeeModule } from "@/components/home/module-catalog";
import { SafetyReportButton } from "@/components/safety/safety-report-button";
import { getCompanyProfile, getMyBrand, listMyTenants } from "@/lib/api/auth";
import { SessionExpiredError } from "@/lib/api/client";
import { EXTERNAL_HOME, isStaffSession } from "@/lib/external-access";
import { TenantProvider } from "@/lib/tenant";

import { signOutAction, switchTenantAction } from "./actions";
import { buildHeaderActionsData } from "./header-actions-props";

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
  // Drives which department modules appear in the nav. Decluttering only
  // — every endpoint behind these links enforces its own require_role.
  const sessionRoles =
    (session as unknown as { roles?: string[] } | null)?.roles ?? [];
  const currentTenant = tenants.find((t) => t.is_current) ?? tenants[0];
  const brand = currentTenant?.name ?? "Peregrine Flight Ops";

  // A customer or supplier login (no staff role) gets the operator's
  // bar and its own page — none of the staff chrome, and none of the
  // staff fetches, which the services would refuse anyway. The proxy
  // has already confined it to the portal and the supplier inbox. See
  // lib/external-access.ts.
  if (!isStaffSession(sessionRoles)) {
    return (
      <ExternalLayout
        tenants={tenants}
        fallbackBrand={brand}
        displayName={
          session?.user?.name?.trim() || session?.user?.email || ""
        }
      >
        {children}
      </ExternalLayout>
    );
  }

  // Per-tenant brand color overrides (M3 branding). Fetched here so every
  // authenticated page inherits the tenant theme without each route
  // re-fetching. Soft-fails to defaults if the auth service is briefly
  // unreachable — the app still renders with platform colors.
  let brandTheme: {
    brand_primary_color: string | null;
    brand_primary_dark_color: string | null;
  } = { brand_primary_color: null, brand_primary_dark_color: null };
  // The tenant's own ops line, for the top bar. The home page used to
  // hardcode +1 (555) 000-0000 in two places, which every tenant would
  // have seen.
  let opsPhone: string | null = null;
  try {
    const profile = await getCompanyProfile();
    brandTheme = {
      brand_primary_color: profile.brand_primary_color,
      brand_primary_dark_color: profile.brand_primary_dark_color,
    };
    opsPhone = profile.ops_phone?.trim() || null;
  } catch {
    // Non-fatal: fall through to defaults.
  }

  // Every prop the top bar needs, assembled in one place — see
  // header-actions-props.ts for why. There is one top bar now, for every
  // page including /home, so this is the only place it is sourced.
  const headerData = session?.user?.email
    ? await buildHeaderActionsData(
        session.user.email,
        session.user.name ?? null,
        sessionRoles,
      )
    : null;

  const actionsSlot = headerData ? (
    <HeaderActions
      {...headerData}
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
      <AppShell
        brand={brand}
        actionsSlot={actionsSlot}
        roles={sessionRoles}
        showOpsChip={rolesCanSeeModule("reservations", sessionRoles)}
        opsPhone={opsPhone}
      >
        {children}
        {/* Spec: global Safety Report button, fixed bottom-right on every
            page. Mounted at the layout so it survives client-side
            navigation between routes inside the (app) group. */}
        <SafetyReportButton />
        <DatePickerAffordance />
      </AppShell>
    </TenantProvider>
  );
}

async function ExternalLayout({
  tenants,
  fallbackBrand,
  displayName,
  children,
}: {
  tenants: Awaited<ReturnType<typeof listMyTenants>>["tenants"];
  fallbackBrand: string;
  displayName: string;
  children: React.ReactNode;
}) {
  // The operator's public face — name, colours, ops line. Soft-fails to
  // the platform defaults, like the staff layout's company profile.
  let brand = fallbackBrand;
  let theme: { primary: string | null; primaryDark: string | null } = {
    primary: null,
    primaryDark: null,
  };
  let opsPhone: string | null = null;
  try {
    const b = await getMyBrand();
    brand = b.name || fallbackBrand;
    theme = {
      primary: b.brand_primary_color,
      primaryDark: b.brand_primary_dark_color,
    };
    opsPhone = b.ops_phone?.trim() || null;
  } catch {
    // Non-fatal.
  }

  return (
    <TenantProvider tenants={tenants} switchTenantAction={switchTenantAction}>
      <BrandThemeStyle primary={theme.primary} primaryDark={theme.primaryDark} />
      <AppShell
        brand={brand}
        actionsSlot={
          <ExternalActions
            displayName={displayName}
            signOutAction={signOutAction}
          />
        }
        opsPhone={opsPhone}
        homeHref={EXTERNAL_HOME}
        showDepartmentNav={false}
      >
        {children}
      </AppShell>
    </TenantProvider>
  );
}
