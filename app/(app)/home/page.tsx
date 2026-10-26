import Link from "next/link";

import { auth } from "@/auth";
import { DEPARTMENTS, departmentForPath, type DepartmentId } from "@/components/app-shell/modules";
import { PageHeader } from "@/components/ff/page-header";
import { Stat, StatStrip } from "@/components/ff/stat-strip";
import { ActiveAlertsPanel } from "@/components/home/active-alerts-panel";
import { HomeImageBand } from "@/components/home/home-image-band";
import { HOME_QUICK_LINKS, QuickLinks } from "@/components/home/quick-links";
import {
  HOME_MODULES,
  HOME_MODULE_ROLES,
  moduleStatusHint,
  type HomeModule,
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

/**
 * /home — the first page after sign-in (#79).
 *
 * ForeFlight's idiom, per Greg's choice (20 Oct): no photo band and no
 * grid of icon tiles. In order:
 *
 *   1. The greeting, with the operator's name above it.
 *   2. Today's figures: airborne, on the ground, aircraft on hold.
 *   3. Active alerts: role-gated, as the M2 spec has it.
 *   4. The departments as a directory: each home entry under the nav
 *      department its route belongs to, a plain link with its one-line
 *      description; the unbuilt ones muted and marked "Soon".
 *   5. Shortcuts.
 *
 * Which entries a user sees is the client's home matrix
 * (HOME_MODULE_ROLES), unchanged; only their presentation moved.
 *
 * A company that sets an image under Settings → Branding (#118) gets it
 * behind the greeting and the figures; without one, Home is as above.
 */
export default async function HomePage() {
  const [session, tenantsResponse, stats, snapshot, profile] = await Promise.all([
    auth(),
    listMyTenants().catch(() => ({ tenants: [] })),
    getFlightStats().catch(() => null),
    loadOperationalSnapshot(),
    getCompanyProfile().catch(() => null),
  ]);
  const homeImage = profile?.home_image_url?.trim() || null;

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



  const groups = directoryGroups(visibleModules);
  const live = visibleModules.filter((m) => m.status === "live").length;

  const opening = (
    <>
      <PageHeader
        eyebrow={currentTenant?.name}
        title={firstName ? `${greeting}, ${firstName}` : greeting}
      />

      <StatStrip label="Today's operation">
        <Stat value={airborne} label="Airborne" tone="green" />
        <Stat value={onGround} label="On the ground" tone="blue" />
        <Stat value={acftHold} label="Aircraft on hold" tone={acftHold > 0 ? "red" : "neutral"} />
      </StatStrip>
    </>
  );

  return (
    <>
      {homeImage ? <HomeImageBand src={homeImage}>{opening}</HomeImageBand> : null}
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-8">
        {homeImage ? null : opening}

        {canSeeAlerts && <ActiveAlertsPanel />}

        <section aria-labelledby="departments-heading" className="mt-10">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
            <h2 id="departments-heading" className="caption-caps text-foreground">
              Departments
            </h2>
            <span className="eyebrow">
              {live} live · {visibleModules.length - live} coming
            </span>
          </div>
          <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <div key={group.id} className="min-w-0">
                <h3 className="eyebrow mb-3 border-b border-border pb-2">{group.label}</h3>
                <ul className="space-y-3.5">
                  {group.modules.map((module) => (
                    <li key={module.id}>
                      <DirectoryEntry module={module} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <QuickLinks links={visibleQuickLinks} />
      </div>
    </>
  );
}

/** Home entries the nav does not place (crew housing) and where they go. */
const DEPARTMENT_OVERRIDES: Record<string, DepartmentId> = {
  // Crew housing is an employee service; the nav has no housing department.
  housing: "hr",
};

/** The visible entries under their nav departments, in the nav's order. */
function directoryGroups(modules: HomeModule[]) {
  const byDept = new Map<DepartmentId, HomeModule[]>();
  for (const m of modules) {
    const dept = DEPARTMENT_OVERRIDES[m.id] ?? departmentForPath(m.href)?.id;
    if (!dept) continue;
    byDept.set(dept, [...(byDept.get(dept) ?? []), m]);
  }
  return DEPARTMENTS.filter((d) => byDept.has(d.id)).map((d) => ({
    id: d.id,
    label: d.label,
    modules: byDept.get(d.id)!,
  }));
}

function DirectoryEntry({ module }: { module: HomeModule }) {
  if (module.status === "live") {
    return (
      <Link href={module.href} className="group block">
        <span className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
          {module.label}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{module.sub}</span>
      </Link>
    );
  }
  return (
    <div title={moduleStatusHint(module.status) ?? undefined} aria-disabled="true">
      <span className="text-sm font-semibold text-muted-foreground">{module.label}</span>
      <span className="eyebrow ml-2">Soon</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{module.sub}</span>
    </div>
  );
}
