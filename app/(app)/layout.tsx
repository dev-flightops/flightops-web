import { auth, signOut } from "@/auth";
import { AppShell } from "@/components/app-shell/app-shell";
import { HeaderActions } from "@/components/app-shell/header-actions";
import { SafetyReportButton } from "@/components/safety/safety-report-button";
import { listMyTenants } from "@/lib/api/auth";
import { SessionExpiredError } from "@/lib/api/client";
import { TenantProvider } from "@/lib/tenant";

import { switchTenantAction } from "./actions";

async function signOutAction(): Promise<void> {
  "use server";
  await signOut({ redirectTo: "/login" });
}

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

  const actionsSlot = session?.user?.email ? (
    <HeaderActions
      email={session.user.email}
      fullName={session.user.name ?? null}
      signOutAction={signOutAction}
    />
  ) : null;

  return (
    <TenantProvider
      tenants={tenants}
      switchTenantAction={switchTenantAction}
    >
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
