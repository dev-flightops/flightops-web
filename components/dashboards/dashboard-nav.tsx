import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Horizontal 8-tab navigation that sits at the top of every dashboard page,
 * matching the legacy `dash_nav` macro layout: 5 primary role tabs on the
 * left, then a flex-grow spacer, then 2 secondary tabs on the right (Ops
 * Score, System Health). Active tab gets a blue tint + bold weight; the
 * rest stay muted.
 *
 * A small banner above the tabs reminds dispatchers that the role-based
 * access control isn't wired yet — today every signed-in user can open
 * every dashboard. RBAC lands when the admin-service ships in M4.
 */

export type DashboardSlug =
  | "executive"
  | "director-ops"
  | "chief-pilot"
  | "station"
  | "dispatcher"
  | "ops-score"
  | "system-health";

interface NavTab {
  slug: DashboardSlug;
  label: string;
  href: string;
  /** Right-aligned tabs (Ops Score, System Health) are visually secondary. */
  secondary?: boolean;
}

const TABS: NavTab[] = [
  { slug: "executive",     label: "Executive",     href: "/dashboards/executive" },
  { slug: "director-ops",  label: "Dir. Ops",      href: "/dashboards/director-ops" },
  { slug: "chief-pilot",   label: "Chief Pilot",   href: "/dashboards/chief-pilot" },
  { slug: "station",       label: "Station",       href: "/dashboards/station" },
  { slug: "dispatcher",    label: "Dispatcher",    href: "/dashboards/dispatcher" },
  { slug: "ops-score",     label: "Ops Score",     href: "/dashboards/ops-score",     secondary: true },
  { slug: "system-health", label: "System",        href: "/dashboards/system-health", secondary: true },
];

export function DashboardNav({ active }: { active: DashboardSlug }) {
  const primary   = TABS.filter((t) => !t.secondary);
  const secondary = TABS.filter((t) =>  t.secondary);

  return (
    <div className="mb-5">
      <div className="mb-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-[0.65rem] text-muted-foreground/80">
        <span className="font-semibold text-muted-foreground">Admin</span>
        {" "}— role-based access control coming soon. These views will be
        restricted by user role.
      </div>

      <nav
        aria-label="Dashboard role views"
        className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-1"
      >
        {primary.map((tab) => (
          <DashboardNavTab key={tab.slug} tab={tab} active={active === tab.slug} />
        ))}
        <span className="flex-1" />
        {secondary.map((tab) => (
          <DashboardNavTab key={tab.slug} tab={tab} active={active === tab.slug} />
        ))}
      </nav>
    </div>
  );
}

function DashboardNavTab({ tab, active }: { tab: NavTab; active: boolean }) {
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      data-testid={`dash-nav-${tab.slug}`}
      className={cn(
        "rounded-md px-2.5 py-1 text-[0.72rem] font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-primary/12 text-status-blue font-semibold"
          : "text-muted-foreground hover:bg-primary/8 hover:text-status-blue",
      )}
    >
      {tab.label}
    </Link>
  );
}
