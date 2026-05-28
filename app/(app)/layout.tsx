import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { AppShell } from "@/components/app-shell/app-shell";
import { UserMenu } from "@/components/app-shell/user-menu";
import { listMyTenants } from "@/lib/api/auth";
import { SessionExpiredError } from "@/lib/api/client";
import { TenantProvider } from "@/lib/tenant";

import { switchTenantAction } from "./actions";

async function signOutAction(): Promise<void> {
  "use server";
  await signOut({ redirectTo: "/login" });
}

/**
 * Layout for the (app) route group — wraps every in-app page (dispatch,
 * dashboards) with the AppShell chrome and a TenantProvider seeded from
 * the backend.
 *
 * Tenants are fetched server-side per layout render. With a single tenant
 * this is cheap; when multi-tenant lands we can swap to a cached/SWR
 * source if it becomes a bottleneck.
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
    // If the session is dead we can't render this group at all — kick the
    // user to /login with a return URL.
    if (error instanceof SessionExpiredError) {
      redirect("/login");
    }
    throw error;
  }

  const session = await auth();
  const userSlot = session?.user?.email ? (
    <UserMenu email={session.user.email} signOutAction={signOutAction} />
  ) : null;

  return (
    <TenantProvider
      tenants={tenants}
      switchTenantAction={switchTenantAction}
    >
      <AppShell userSlot={userSlot}>{children}</AppShell>
    </TenantProvider>
  );
}
