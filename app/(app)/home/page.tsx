import { auth } from "@/auth";
import {
  HOME_QUICK_LINKS,
  QuickLinks,
} from "@/components/home/quick-links";
import { ModuleCard } from "@/components/home/module-card";
import { HOME_MODULES } from "@/components/home/module-catalog";
import { StatusStrip, type StatusItem } from "@/components/home/status-strip";
import { listMyTenants } from "@/lib/api/auth";
import { getFlightStats } from "@/lib/api/ops";
import { currentGreeting, firstNameFrom } from "@/lib/greeting";

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
  const [session, tenantsResponse, stats] = await Promise.all([
    auth(),
    listMyTenants().catch(() => ({ tenants: [] })),
    // Stats degrade to zeros if the backend hiccups — the demo audience
    // sees a working layout instead of a 500.
    getFlightStats().catch(() => null),
  ]);

  const currentTenant =
    tenantsResponse.tenants.find((t) => t.is_current) ??
    tenantsResponse.tenants[0];

  const userEmail = session?.user?.email ?? "";
  const firstName =
    firstNameFrom(session?.user?.name) || firstNameFrom(userEmail.split("@")[0]);
  const greeting = currentGreeting();

  const onGround = stats ? stats.today.scheduled + stats.today.released : 0;
  const acftHold = stats
    ? Math.max(0, stats.aircraft_total - stats.aircraft_active)
    : 0;

  const statusItems: StatusItem[] = [
    // "airborne" needs flight-following (M2) — show 0 with a muted treatment
    // so demo audiences don't read it as a live tracker.
    { value: 0, label: "airborne", pending: true },
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
