import { auth } from "@/auth";
import { ActiveAlertsPanel } from "@/components/home/active-alerts-panel";
import {
  HOME_QUICK_LINKS,
  QuickLinks,
} from "@/components/home/quick-links";
import { ModuleCard } from "@/components/home/module-card";
import { HOME_MODULES } from "@/components/home/module-catalog";
import { StatusStrip, type StatusItem } from "@/components/home/status-strip";
import { listMyTenants } from "@/lib/api/auth";
import { getFlightStats } from "@/lib/api/ops";
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
  // The demo user comes through as "admin" in the seeded data; treat
  // that as the SA equivalent so the panel is visible in QA.
  "admin",
]);

/**
 * Home page — pixel-match for `dispatch-platform-main/templates/home.html`.
 *
 * Layout:
 *   1. Centered greeting (company name + "Good morning, {firstName}")
 *   2. Status strip — 4 inline counters
 *   3. Module grid (3-col) — 15 cards, role-gated in legacy but here all
 *      visible with future-milestone modules disabled per project policy
 *   4. Quick links footer — role-gated shortcuts, also all disabled until
 *      their underlying modules ship
 *
 * Lives inside the (app) route group so it inherits the AppShell (top nav
 * + tenant switcher + user menu + department sub-nav).
 */
export default async function HomePage() {
  // Pull everything in parallel. listMyTenants is also fetched by the (app)
  // layout for the tenant switcher; the duplicate call is the price of
  // keeping the home page self-contained.
  const [session, tenantsResponse, stats, snapshot] = await Promise.all([
    auth(),
    listMyTenants().catch(() => ({ tenants: [] })),
    // Stats degrade to zeros if the backend hiccups — the demo audience
    // sees a working layout instead of a 500.
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

  // Airborne pulls from the shared snapshot (released + actual_departure_at
  // set, not yet arrived). On-ground = today's flights minus the airborne
  // count — released-but-not-yet-departed counts as on ground.
  const airborne = snapshot.airborneCount;
  const todayTotal = stats
    ? stats.today.scheduled + stats.today.released
    : 0;
  const onGround = Math.max(0, todayTotal - airborne);
  const acftHold = stats
    ? Math.max(0, stats.aircraft_total - stats.aircraft_active)
    : 0;

  const statusItems: StatusItem[] = [
    { value: airborne, label: "airborne", color: "#34d399" },
    { value: onGround, label: "on ground", color: "#fbbf24" },
  ];
  if (acftHold > 0) {
    statusItems.push({ value: acftHold, label: "acft hold", color: "#f87171" });
  }

  return (
    <div className="mx-auto max-w-[820px] px-5 pb-12 pt-10">
      {/* Greeting */}
      <div className="mb-1 text-center">
        <h1 className="text-xl font-bold text-foreground">
          {currentTenant?.name ?? "FlightOps"}
        </h1>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </p>
      </div>

      <StatusStrip items={statusItems} />

      {canSeeAlerts && <ActiveAlertsPanel />}

      {/* Module grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {HOME_MODULES.map((module) => (
          <ModuleCard key={module.id} module={module} />
        ))}
      </div>

      <QuickLinks links={HOME_QUICK_LINKS} />
    </div>
  );
}
