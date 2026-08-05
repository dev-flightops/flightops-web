import { auth } from "@/auth";
import { signOutAction } from "@/app/(app)/actions";
import {
  clockInAction,
  clockOutAction,
} from "@/app/(app)/duty-actions";
import { HeaderActions } from "@/components/app-shell/header-actions";
import { ActiveAlertsPanel } from "@/components/home/active-alerts-panel";
import { HomeHero } from "@/components/home/home-hero";
import { HomeModuleCard } from "@/components/home/home-module-card";
import { HomeTopBar } from "@/components/home/home-topbar";
import {
  HOME_QUICK_LINKS,
  QuickLinks,
} from "@/components/home/quick-links";
import { HOME_MODULES } from "@/components/home/module-catalog";
import { listMyTenants } from "@/lib/api/auth";
import { getCurrentDuty, getFlightStats } from "@/lib/api/ops";
import type { CurrentDutyResponse } from "@/lib/api/types";
import { loadOperationalSnapshot } from "@/lib/dashboards/operational-snapshot";
import { currentGreeting, firstNameFrom } from "@/lib/greeting";

/**
 * Roles permitted to see the Active Alerts panel per the Home Page
 * spec, Component 5: Super Admin, Director of Operations, Chief Pilot,
 * Dispatcher, Safety Officer. Other roles get the standard tile grid
 * without the alerts section.
 */
const ALERT_VIEWING_ROLES = new Set([
  "super_admin",
  "director_of_operations",
  "chief_pilot",
  "dispatcher",
  "safety_officer",
  "admin",
]);

/**
 * /home — pitch landing.
 *
 * Owns its own top chrome (the app-shell hides its default header on this
 * route). Layout:
 *
 *   1. HomeTopBar        — dark black bar with a red primary chip, brand
 *                          wordmark, phone, and the default HeaderActions
 *                          cluster re-tinted for the dark background
 *   2. HomeHero          — light-gray secondary header + photo hero
 *                          (dark overlay) + ops-line strip with a red CTA
 *   3. Active Alerts     — unchanged, role-gated (M2 spec)
 *   4. Departments       — white surface with HomeModuleCard tiles
 *   5. Quick links       — unchanged footer strip
 */
export default async function HomePage() {
  const [session, tenantsResponse, stats, snapshot] = await Promise.all([
    auth(),
    listMyTenants().catch(() => ({ tenants: [] })),
    getFlightStats().catch(() => null),
    loadOperationalSnapshot(),
  ]);

  const currentTenant =
    tenantsResponse.tenants.find((t) => t.is_current) ??
    tenantsResponse.tenants[0];

  const userEmail = session?.user?.email ?? "";
  const firstName =
    firstNameFrom(session?.user?.name) || firstNameFrom(userEmail.split("@")[0]);
  const greeting = currentGreeting();

  const sessionRoles =
    (session as unknown as { roles?: string[] } | null)?.roles ?? [];
  const canSeeAlerts = sessionRoles.some((r) => ALERT_VIEWING_ROLES.has(r));

  const hasAdminAccess = Boolean(
    (session as unknown as { admin_access?: boolean } | null)?.admin_access,
  );
  const roleSet = new Set(sessionRoles);
  const visibleModules = HOME_MODULES.filter((m) => {
    if (m.id === "admin" && !hasAdminAccess) return false;
    if (m.roleGate && !roleSet.has(m.roleGate)) return false;
    return true;
  });

  const airborne = snapshot.airborneCount;
  const todayTotal = stats
    ? stats.today.scheduled + stats.today.released
    : 0;
  const onGround = Math.max(0, todayTotal - airborne);
  const acftHold = stats
    ? Math.max(0, stats.aircraft_total - stats.aircraft_active)
    : 0;

  // Default HeaderActions cluster — same items as the rest of the app.
  // Only the surrounding dark bar re-skins the container.
  //
  // /home renders its own top bar instead of using the (app) layout's
  // AppShellHeader, so the duty seed + server actions the layout
  // otherwise pipes into HeaderActions have to be sourced here too.
  // Without them the top-bar Clock In pill falls back to the disabled
  // "unavailable" placeholder for /home only.
  let initialDuty: CurrentDutyResponse | null = null;
  try {
    initialDuty = await getCurrentDuty();
  } catch {
    initialDuty = null;
  }

  const actionsSlot = userEmail ? (
    <HeaderActions
      email={userEmail}
      fullName={session?.user?.name ?? null}
      signOutAction={signOutAction}
      initialDuty={initialDuty}
      clockInAction={clockInAction}
      clockOutAction={clockOutAction}
    />
  ) : null;

  return (
    // Full-bleed white surface so /home owns the entire viewport — the
    // standard app-shell dark chrome is hidden for this route (see
    // AppShellHeader) and our HomeTopBar / HomeHero render at the top.
    <div className="min-h-screen bg-white">
      <HomeTopBar
        brand={currentTenant?.name ?? "FlightOps"}
        phone="+1 (555) 000-0000"
        actionsSlot={actionsSlot}
      />
      <HomeHero
        tenantName={currentTenant?.name ?? "FlightOps"}
        greeting={greeting}
        firstName={firstName}
        airborne={airborne}
        onGround={onGround}
        acftHold={acftHold}
      />

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-8">
        {canSeeAlerts && (
          <div className="pt-8">
            <ActiveAlertsPanel />
          </div>
        )}

        {/* Departments — clean white content block */}
        <section className="pt-10">
          <div className="mb-6 flex items-baseline justify-between border-b border-black/10 pb-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
                Departments
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Every module in the platform, one click away.
              </p>
            </div>
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              {visibleModules.filter((m) => m.status === "live").length} live ·{" "}
              {visibleModules.filter((m) => m.status !== "live").length} coming
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleModules.map((module) => (
              <HomeModuleCard key={module.id} module={module} />
            ))}
          </div>
        </section>

        <QuickLinks links={HOME_QUICK_LINKS} />
      </div>
    </div>
  );
}
