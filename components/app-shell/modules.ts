/**
 * Module catalogue — drives the AppShell's two-level navigation.
 *
 * Each top-level entry is a *department* (Operations, Admin, Maintenance,
 * etc.). The DepartmentNav row (the breadcrumb-style nav directly below
 * the global header) shows the children of whichever department the
 * current URL belongs to. So on `/dispatch/` you see the Operations
 * children; on `/dashboards/*` you see the Admin children. This mirrors
 * the legacy `base.html` `dept` variable + per-dept link rows.
 *
 * Adding a new module:
 *   1. Add the entry under the right department's `children`.
 *   2. Set `status: "live"` and `href: "/your/route"`.
 *   3. The DepartmentNav picks it up automatically when the URL lands
 *      on that route (or any prefix under it).
 */

export type ModuleStatus = "live" | "m2" | "m3" | "m4";

export interface ModuleEntry {
  id: string;
  label: string;
  href?: string;
  status: ModuleStatus;
  /** Department this belongs to (also used to pick the active primary tab). */
  department: DepartmentId;
  /** Visual accent. `purple` is reserved for the legacy "AI" group
   * (Fleet Brain / Ops Brief / AI Query / Intelligence) — these get a
   * sparkle in the label and purple text. */
  accent?: "purple";
  /** When true, render a small vertical divider before this entry —
   * used to separate the AI group from the rest of the admin nav. */
  dividerBefore?: boolean;
  /** When true, insert a flex spacer before this entry so it floats to
   * the right edge of the nav row (legacy `<span style="flex:1;"></span>`
   * before Users in admin). */
  pushRight?: boolean;
}

export type DepartmentId =
  | "operations"
  | "maintenance"
  | "crew"
  | "safety"
  | "admin"
  | "ai";

export interface Department {
  id: DepartmentId;
  label: string;
  status: ModuleStatus;
  /** When the user is anywhere under one of these path prefixes, this
   * department's tab is active and its children render as the sub-nav. */
  pathPrefixes: string[];
  children: ModuleEntry[];
}

const ms = (status: ModuleStatus): string => {
  if (status === "live") return "";
  return `Coming in ${status.toUpperCase()}`;
};

export const DEPARTMENTS: Department[] = [
  {
    id: "operations",
    label: "Operations",
    status: "live",
    /**
     * The Operations dept covers the day-to-day dispatch workflow. Note
     * `/dashboards` is intentionally NOT in this list — dashboards live
     * under the Admin dept, matching the legacy `base.html` mapping.
     */
    pathPrefixes: [
      "/dispatch",
      "/following",
      "/weather",
      "/crew",
      "/currency",
      "/flight-log",
      "/roster",
      "/pilot-history",
      "/village-wx",
      "/ramp-ops",
      "/eod",
    ],
    /**
     * Mirrors legacy `templates/base.html:403-419` — the operations
     * sub-nav exactly. Items without a target route render as disabled
     * chips with a milestone tooltip.
     */
    children: [
      { id: "dispatch",         label: "Dispatch",         href: "/dispatch", status: "live", department: "operations" },
      { id: "flight-following", label: "Flight Following", status: "m2", department: "operations" },
      { id: "weather",          label: "Weather",          status: "m2", department: "operations" },
      { id: "crew",             label: "Crew",             status: "m3", department: "operations" },
      { id: "currency",         label: "Currency",         status: "m3", department: "operations" },
      { id: "flight-log",       label: "Flight Log",       status: "m2", department: "operations" },
      { id: "roster",           label: "Roster",           status: "m3", department: "operations" },
      { id: "pilot-history",    label: "Pilot History",    status: "m3", department: "operations" },
      { id: "village-wx",       label: "Village Wx",       status: "m2", department: "operations" },
      { id: "ramp-ops",         label: "Ramp Ops",         status: "m2", department: "operations" },
      { id: "eod",              label: "EOD",              status: "m2", department: "operations" },
      { id: "intelligence",     label: "✨ Intelligence",   status: "m4", department: "operations", accent: "purple" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    status: "live",
    /**
     * The Admin dept covers dashboards + reporting + financials + AI tools
     * (legacy `base.html:475-499`). Dashboards (5 routes) are live in M1;
     * reports / financial / AI are all M4.
     */
    pathPrefixes: [
      "/dashboards",
      "/reports",
      "/profitability",
      "/invoicing",
      "/accounting",
      "/fleetbrain",
      "/ai",
      "/settings/users",
      "/reservations/sim-export",
    ],
    /**
     * Mirrors legacy `templates/base.html:475-499`. "Dispatch" appears
     * twice across navs — in Operations it links to the dispatch form,
     * in Admin it links to the Dispatcher dashboard. Same label, two
     * destinations, intentional.
     */
    children: [
      { id: "dashboard-executive",    label: "Executive",   href: "/dashboards/executive",    status: "live", department: "admin" },
      { id: "dashboard-director-ops", label: "Dir. Ops",    href: "/dashboards/director-ops", status: "live", department: "admin" },
      { id: "dashboard-chief-pilot",  label: "Chief Pilot", href: "/dashboards/chief-pilot",  status: "live", department: "admin" },
      { id: "dashboard-dispatcher",   label: "Dispatch",    href: "/dashboards/dispatcher",   status: "live", department: "admin" },
      { id: "dashboard-ops-score",    label: "Ops Score",   href: "/dashboards/ops-score",    status: "live", department: "admin" },
      { id: "reports",                label: "Reports",     status: "m4", department: "admin" },
      { id: "reports-executive",      label: "Executive",   status: "m4", department: "admin" },
      { id: "reports-regulatory",     label: "Regulatory",  status: "m4", department: "admin" },
      { id: "reports-sim-export",     label: "SIM Export",  status: "m4", department: "admin" },
      { id: "reports-bi",             label: "BI",          status: "m4", department: "admin" },
      { id: "profitability",          label: "Profitability", status: "m4", department: "admin" },
      { id: "invoicing",              label: "Invoicing",   status: "m4", department: "admin" },
      { id: "accounting",             label: "Accounting",  status: "m4", department: "admin" },
      { id: "fleetbrain",             label: "✨ Fleet Brain", status: "m4", department: "admin", accent: "purple", dividerBefore: true },
      { id: "ops-brief",              label: "Ops Brief",   status: "m4", department: "admin", accent: "purple" },
      { id: "ai-query",               label: "AI Query",    status: "m4", department: "admin", accent: "purple" },
      { id: "users",                  label: "Users",       status: "m4", department: "admin", pushRight: true },
    ],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    status: "m2",
    pathPrefixes: ["/maintenance"],
    children: [
      { id: "fleet",       label: "Fleet",       status: "m2", department: "maintenance" },
      { id: "work-orders", label: "Work Orders", status: "m2", department: "maintenance" },
      { id: "mel",         label: "MEL",         status: "m2", department: "maintenance" },
      { id: "squawks",     label: "Squawks",     status: "m2", department: "maintenance" },
    ],
  },
  {
    id: "crew",
    label: "Crew",
    status: "m3",
    pathPrefixes: ["/crew-admin"],
    children: [
      { id: "crew-roster",   label: "Roster",      status: "m3", department: "crew" },
      { id: "duty-rest",     label: "Duty & Rest", status: "m3", department: "crew" },
      { id: "training",      label: "Training",    status: "m3", department: "crew" },
      { id: "crew-payroll",  label: "Payroll",     status: "m3", department: "crew" },
    ],
  },
  {
    id: "safety",
    label: "Safety",
    status: "m3",
    pathPrefixes: ["/safety"],
    children: [
      { id: "sms",       label: "Safety SMS", status: "m3", department: "safety" },
      { id: "documents", label: "Documents",  status: "m3", department: "safety" },
    ],
  },
  {
    id: "ai",
    label: "AI",
    status: "m4",
    pathPrefixes: ["/ai-tools"],
    children: [
      { id: "ai-fleetbrain",         label: "Fleet Brain",          status: "m4", department: "ai" },
      { id: "ai-morning-brief",      label: "Morning Brief",        status: "m4", department: "ai" },
      { id: "ai-safety-intelligence", label: "Safety Intelligence", status: "m4", department: "ai" },
    ],
  },
];

/**
 * Find the active department for a given URL pathname. Returns null when
 * the path doesn't belong to any department (e.g. the root home page or
 * the login page).
 */
export function departmentForPath(pathname: string): Department | null {
  for (const dept of DEPARTMENTS) {
    if (dept.pathPrefixes.some((prefix) => pathname.startsWith(prefix))) {
      return dept;
    }
  }
  return null;
}

/** Human-readable status hint for tooltips on disabled modules. */
export function moduleStatusHint(status: ModuleStatus): string {
  return ms(status);
}
