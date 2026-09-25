import { auth } from "@/auth";
import { ActiveAlertsPanel } from "@/components/home/active-alerts-panel";
import { HomeHero } from "@/components/home/home-hero";
import { HomeModuleCard } from "@/components/home/home-module-card";
import { HOME_QUICK_LINKS, QuickLinks } from "@/components/home/quick-links";
import {
  HOME_MODULES,
  HOME_MODULE_ROLES,
} from "@/components/home/module-catalog";
import { getCompanyProfile, listMyTenants } from "@/lib/api/auth";
import { getFlightStats } from "@/lib/api/ops";
import { loadOperationalSnapshot } from "@/lib/dashboards/operational-snapshot";
import { currentGreeting, firstNameFrom } from "@/lib/greeting";
import { hasAnyRole, roleGate } from "@/lib/roles";

/**
 * Roles permitted to see the Active Alerts panel per the Home Page
 * spec, Component 5. Other roles get the tile grid without it.
 *
 * The spec names "Super Admin" and "Director of Operations"; this
 * platform's equivalent is the single `exec_admin` role. The set used to
 * carry the spec's wording literally — "super_admin",
 * "director_of_operations", "admin" — none of which are roles anyone
 * holds, so the most privileged account on the system silently failed
 * the check while Chief Pilot, Dispatcher and Safety Officer passed it.
 * Half-working is why it went unnoticed.
 *
 * Typed via roleGate(), so a name that is not a real role now fails to
 * compile rather than quietly never matching.
 */
const ALERT_VIEWING_ROLES = roleGate(
  "exec_admin",
  "chief_pilot",
  "director_of_operations",
  "dispatcher",
  "safety_officer",
);

/** Split a tenant's display name into wordmark + subtitle for the
 *  logo band. First word becomes the wordmark, the rest joined
 *  becomes the subtitle. Falls back to the neutral product wordmark
 *  when the tenant name is missing or single-word. */
function wordmarkFromName(name: string | undefined): {
  wordmark: string | undefined;
  subtitle: string | undefined;
} {
  if (!name) return { wordmark: undefined, subtitle: undefined };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { wordmark: parts[0].toUpperCase(), subtitle: undefined };
  }
  return {
    wordmark: parts[0].toUpperCase(),
    subtitle: parts.slice(1).join(" ").toUpperCase(),
  };
}

/**
 * /home — pitch landing.
 *
 * The top bar comes from the app shell, as on every page — this page's
 * own design, which the whole app now shares. Layout:
 *
 *   1. HomeHero          — brand band + photo hero (an ink island) +
 *                          the tenant's ops line, when they have one
 *   3. Active Alerts     — unchanged, role-gated (M2 spec)
 *   4. Departments       — white surface with HomeModuleCard tiles
 *   5. Quick links       — unchanged footer strip
 */
export default async function HomePage() {
  const [session, tenantsResponse, stats, snapshot, profile] = await Promise.all([
    auth(),
    listMyTenants().catch(() => ({ tenants: [] })),
    getFlightStats().catch(() => null),
    loadOperationalSnapshot(),
    // The layout fetches this too; Next memoises identical GETs within a
    // request, so it is one call.
    getCompanyProfile().catch(() => null),
  ]);
  const opsPhone = profile?.ops_phone?.trim() || null;

  const currentTenant =
    tenantsResponse.tenants.find((t) => t.is_current) ??
    tenantsResponse.tenants[0];

  const userEmail = session?.user?.email ?? "";
  const firstName =
    firstNameFrom(session?.user?.name) ||
    firstNameFrom(userEmail.split("@")[0]);
  const greeting = currentGreeting();

  const sessionRoles =
    (session as unknown as { roles?: string[] } | null)?.roles ?? [];
  const canSeeAlerts = hasAnyRole(sessionRoles, ALERT_VIEWING_ROLES);

  const hasAdminAccess = Boolean(
    (session as unknown as { admin_access?: boolean } | null)?.admin_access,
  );
  const roleSet = new Set(sessionRoles);
  const visibleModules = HOME_MODULES.filter((m) => {
    if (m.id === "admin" && !hasAdminAccess) return false;
    if (m.roleGate && !roleSet.has(m.roleGate)) return false;
    // Role-scoped tiles (client request 8/25). Fails open on an empty
    // role list so a session that failed to carry roles shows a cluttered
    // home rather than an empty one; the pages themselves still gate.
    const allowed = HOME_MODULE_ROLES[m.id];
    if (allowed && sessionRoles.length > 0) {
      if (!sessionRoles.some((r) => (allowed as readonly string[]).includes(r)))
        return false;
    }
    return true;
  });

  // Shortcuts follow the same matrix as the tiles and the nav. Fails
  // open on an empty role list for the same reason.
  const visibleQuickLinks = HOME_QUICK_LINKS.filter((l) => {
    if (!l.roles || sessionRoles.length === 0) return true;
    return sessionRoles.some((r) => (l.roles as readonly string[]).includes(r));
  });

  const airborne = snapshot.airborneCount;
  const todayTotal = stats ? stats.today.scheduled + stats.today.released : 0;
  const onGround = Math.max(0, todayTotal - airborne);
  const acftHold = stats
    ? Math.max(0, stats.aircraft_total - stats.aircraft_active)
    : 0;



  return (
    <div>
      <HomeHero
        tenantName={currentTenant?.name ?? "FlightOps"}
        wordmark={wordmarkFromName(currentTenant?.name).wordmark}
        wordmarkSubtitle={wordmarkFromName(currentTenant?.name).subtitle}
        greeting={greeting}
        firstName={firstName}
        airborne={airborne}
        onGround={onGround}
        acftHold={acftHold}
        opsPhone={opsPhone}
      />

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-8">
        {canSeeAlerts && (
          <div className="pt-8">
            <ActiveAlertsPanel />
          </div>
        )}

        <section className="pt-10">
          <div className="mb-6 flex items-baseline justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Departments
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Every module in the platform, one click away.
              </p>
            </div>
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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

        <QuickLinks links={visibleQuickLinks} />
      </div>
    </div>
  );
}
