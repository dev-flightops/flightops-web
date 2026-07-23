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
  | "reservations"
  | "academy"
  | "ground-ops"
  | "maintenance"
  | "crew"
  | "hr"
  | "safety"
  | "admin"
  | "settings"
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
      "/flight-following",
      "/schedule",
      "/weather",
      "/crew",
      "/currency",
      "/flight-log",
      "/flight-crew",
      "/compliance",
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
      { id: "flight-following", label: "Flight Following", href: "/flight-following", status: "live", department: "operations" },
      { id: "schedule",         label: "Schedule",         href: "/schedule", status: "live", department: "operations" },
      { id: "weather",          label: "Weather",          href: "/weather", status: "live", department: "operations" },
      { id: "crew",             label: "Crew",             status: "m3", department: "operations" },
      { id: "currency",         label: "Currency",         href: "/compliance/crew-currency", status: "live", department: "operations" },
      { id: "flight-log",       label: "Flight Log",       href: "/flight-crew/elog", status: "live", department: "operations" },
      { id: "roster",           label: "Roster",           status: "m3", department: "operations" },
      { id: "pilot-history",    label: "Pilot History",    status: "m3", department: "operations" },
      { id: "village-wx",       label: "Village Wx",       href: "/village-wx", status: "live", department: "operations" },
      { id: "ramp-ops",         label: "Ramp Ops",         href: "/ramp-ops", status: "live", department: "operations" },
      { id: "eod",              label: "EOD",              href: "/eod", status: "live", department: "operations" },
      { id: "intelligence",     label: "Intelligence",     status: "m4", department: "operations", accent: "purple" },
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
      { id: "dashboard-station",      label: "Station",     href: "/dashboards/station",      status: "live", department: "admin" },
      { id: "dashboard-ops-score",    label: "Ops Score",   href: "/dashboards/ops-score",    status: "live", department: "admin" },
      { id: "dashboard-system",       label: "System",      href: "/dashboards/system-health", status: "live", department: "admin" },
      { id: "reports",                label: "Reports",     status: "m4", department: "admin" },
      { id: "reports-executive",      label: "Executive",   status: "m4", department: "admin" },
      { id: "reports-regulatory",     label: "Regulatory",  status: "m4", department: "admin" },
      { id: "reports-sim-export",     label: "SIM Export",  status: "m4", department: "admin" },
      { id: "reports-bi",             label: "BI",          status: "m4", department: "admin" },
      { id: "profitability",          label: "Profitability", status: "m4", department: "admin" },
      { id: "invoicing",              label: "Invoicing",   status: "m4", department: "admin" },
      { id: "accounting",             label: "Accounting",  status: "m4", department: "admin" },
      { id: "fleetbrain",             label: "Fleet Brain",    status: "m4", department: "admin", accent: "purple", dividerBefore: true },
      { id: "ops-brief",              label: "Ops Brief",   status: "m4", department: "admin", accent: "purple" },
      { id: "ai-query",               label: "AI Query",    status: "m4", department: "admin", accent: "purple" },
    ],
  },
  {
    id: "academy",
    label: "Academy",
    status: "live",
    /**
     * M3 Academy — course catalog + enrolment + lesson player. Admin
     * screens (Manage) sit under the same dept prefix so chief pilots
     * don't context-switch to a separate area.
     */
    pathPrefixes: ["/academy"],
    children: [
      { id: "academy-dashboard",      label: "Dashboard",      href: "/academy/dashboard",   status: "live", department: "academy" },
      { id: "academy-course-library", label: "Course Library", href: "/academy",             status: "live", department: "academy" },
      { id: "academy-assignments",    label: "Assignments",    href: "/academy/assignments", status: "live", department: "academy" },
      { id: "academy-reports",        label: "Reports",        href: "/academy/reports",     status: "live", department: "academy" },
      { id: "academy-studio",         label: "Studio",         href: "/academy/studio",      status: "live", department: "academy" },
    ],
  },
  {
    id: "reservations",
    label: "Reservations",
    status: "live",
    /**
     * M3 Reservations module — fleet-board style booking surface +
     * customer directory. `sim-export` under /reservations/ still lives
     * under the Admin dept per legacy grouping; we exclude it from the
     * pathPrefixes here so the sub-nav renders correctly on both surfaces.
     */
    pathPrefixes: ["/reservations", "/customers"],
    /**
     * Sub-nav order matches legacy peregrineflight.com/reservations/:
     *   New Booking · Fleet Board · Customers · Charter · Quyana ·
     *   Accounting Export
     *
     * "New Booking" is the search-flights landing (mirrors the legacy
     * shopping-style form); "Fleet Board" is the day-grouped bookings
     * list (dispatcher view). Fares / Scripts from legacy are queued
     * for M3 follow-up (fare-class inventory + saved scripts).
     */
    children: [
      { id: "reservations-search", label: "New Booking", href: "/reservations", status: "live", department: "reservations" },
      { id: "reservations-board", label: "Fleet Board", href: "/reservations/fleet-board", status: "live", department: "reservations" },
      { id: "reservations-customers", label: "Customers", href: "/customers", status: "live", department: "reservations" },
      { id: "reservations-charter", label: "Charter", href: "/reservations/charter", status: "live", department: "reservations" },
      { id: "reservations-quyana", label: "Quyana", href: "/reservations/quyana", status: "live", department: "reservations" },
      { id: "reservations-acct-export", label: "Accounting Export", href: "/reservations/accounting-export", status: "live", department: "reservations" },
    ],
  },
  {
    id: "ground-ops",
    label: "Ground Ops",
    status: "live",
    /**
     * Mirrors legacy `templates/ground_ops/hub.html` — top-level dept for
     * Stations, Equipment (GSE), Fuel, and Ramper. All children landed
     * across M2 (M2-G-38, M2-G-39, M2-G-40/43/44/45 fuel vertical,
     * ramper redesign, fuel quality log) so the dept chip itself reads
     * live as of M2 close.
     */
    pathPrefixes: ["/ground-ops", "/stations", "/equipment", "/fuel", "/ramper"],
    children: [
      { id: "ground-ops-hub", label: "Hub", href: "/ground-ops", status: "live", department: "ground-ops" },
      { id: "stations",       label: "Stations", href: "/stations", status: "live", department: "ground-ops" },
      { id: "equipment",      label: "Equipment", href: "/equipment", status: "live", department: "ground-ops" },
      { id: "fuel",           label: "Fuel", href: "/fuel", status: "live", department: "ground-ops" },
      { id: "suppliers",      label: "Suppliers", href: "/fuel/suppliers", status: "live", department: "ground-ops" },
      { id: "ramper",         label: "Ramper", href: "/ramper", status: "live", department: "ground-ops" },
    ],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    status: "live",
    pathPrefixes: ["/maintenance"],
    /**
     * Mirrors legacy `templates/maintenance/dashboard.html` subnav
     * exactly — Fleet / Work Orders / RTS / Inventory / Expiration /
     * Batch Trace / MX Clock / Availability / ✨ MX Intel. None of
     * the M3 items have routes yet; they render as disabled chips
     * with milestone tooltips.
     *
     * MEL + Squawks are intentionally NOT in this list. In the legacy
     * those live inside the per-aircraft Fleet detail (and we mirror
     * that — both appear on /maintenance/aircraft/[id]). The cross-
     * fleet /maintenance/mel and /maintenance/squawks routes that
     * M2-G-21 ships stay reachable by URL but don't get a subnav chip,
     * preserving legacy parity.
     */
    children: [
      { id: "fleet",         label: "Fleet",         href: "/maintenance",              status: "live", department: "maintenance" },
      { id: "work-orders",   label: "Work Orders",   href: "/maintenance/work-orders",  status: "live", department: "maintenance" },
      { id: "rts",           label: "RTS",           href: "/maintenance/rts",          status: "live", department: "maintenance" },
      { id: "inventory",     label: "Inventory",     href: "/maintenance/inventory",    status: "live", department: "maintenance" },
      { id: "expiration",    label: "Expiration",    href: "/maintenance/expiration",   status: "live", department: "maintenance" },
      { id: "batch-trace",   label: "Batch Trace",   href: "/maintenance/batch-trace",  status: "live", department: "maintenance" },
      { id: "mx-clock",      label: "MX Clock",      href: "/maintenance/mx-clock",     status: "live", department: "maintenance" },
      { id: "availability",  label: "Availability",  href: "/maintenance/availability", status: "live", department: "maintenance" },
      { id: "mx-intel",      label: "MX Intel",      status: "m4", department: "maintenance", accent: "purple" },
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
    id: "hr",
    label: "HR",
    status: "live",
    /**
     * Mirrors legacy `peregrineflight.com/employees/` sub-nav:
     *   HR (active) · Payroll · Time Clock · Records
     *
     * HR = employee directory. Payroll + Time Clock are Marc's M3
     * backend stories; Records points to the existing compliance
     * surface (records-and-compliance overlaps operationally with
     * employee training records).
     */
    pathPrefixes: ["/employees", "/payroll", "/time-clock"],
    children: [
      { id: "hr-employees",  label: "HR",        href: "/employees", status: "live", department: "hr" },
      { id: "hr-payroll",    label: "Payroll",   href: "/payroll",   status: "live", department: "hr" },
      { id: "hr-time-clock", label: "Time Clock", href: "/time-clock", status: "live", department: "hr" },
      { id: "hr-records",    label: "Records",   href: "/compliance", status: "live", department: "hr" },
    ],
  },
  {
    id: "safety",
    label: "Safety",
    status: "live",
    pathPrefixes: ["/safety"],
    children: [
      { id: "sms",         label: "Safety SMS",      href: "/safety",            status: "live", department: "safety" },
      { id: "incidents",   label: "Incidents",       href: "/safety/incidents",  status: "live", department: "safety" },
      { id: "actions",     label: "Corrective Actions", href: "/safety/actions", status: "live", department: "safety" },
      { id: "my-reports",  label: "My Reports",      href: "/safety/mine",       status: "live", department: "safety" },
      { id: "documents",   label: "Documents",                                    status: "m3",   department: "safety" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    status: "live",
    /**
     * Settings is its own top-level surface — matches the legacy
     * `templates/settings/index.html` sub-nav (Settings · Users ·
     * Company · Costs · Load Teams · Permissions · SSO · …). Lives
     * outside the Admin dept (which is dashboards + reporting +
     * financials + AI tools) so the global gear icon in the header
     * has its own scope and doesn't share a sub-nav with /dashboards.
     */
    pathPrefixes: ["/settings"],
    children: [
      { id: "settings-home",     label: "Overview",        href: "/settings",                  status: "live", department: "settings" },
      { id: "settings-users",    label: "Users",           href: "/settings/users",            status: "live", department: "settings" },
      { id: "settings-company",  label: "Company",         href: "/settings/company",          status: "live", department: "settings" },
      { id: "settings-bases",    label: "Bases",           href: "/settings/bases",            status: "live", department: "settings" },
      { id: "settings-tracking", label: "Flight Tracking", href: "/settings/flight-tracking",  status: "live", department: "settings" },
      { id: "settings-perms",    label: "Permissions",     href: "/settings/permissions",      status: "live", department: "settings" },
      { id: "settings-sso",      label: "SSO",             href: "/settings/sso",              status: "live", department: "settings" },
      // M3+ — placeholders matching the legacy sub-nav order. Each
      // becomes a real link once its surface ships.
      { id: "settings-costs",     label: "Costs",         status: "m4", department: "settings" },
      { id: "settings-load",      label: "Load Teams",    status: "m3", department: "settings" },
      { id: "settings-pilotpay",  label: "Pilot Pay",     status: "m3", department: "settings" },
      { id: "settings-currency",  label: "Currency",      status: "m3", department: "settings" },
      { id: "settings-billing",   label: "Billing",       status: "m3", department: "settings" },
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
