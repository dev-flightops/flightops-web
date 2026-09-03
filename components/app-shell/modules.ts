import { ROLES, type Role } from "@/lib/roles";

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
      {
        id: "dispatch",
        label: "Dispatch",
        href: "/dispatch",
        status: "live",
        department: "operations",
      },
      {
        id: "flight-following",
        label: "Flight Following",
        href: "/flight-following",
        status: "live",
        department: "operations",
      },
      {
        id: "schedule",
        label: "Schedule",
        href: "/schedule",
        status: "live",
        department: "operations",
      },
      {
        id: "weather",
        label: "Weather",
        href: "/weather",
        status: "live",
        department: "operations",
      },
      { id: "crew", label: "Crew", status: "m3", department: "operations" },
      {
        id: "currency",
        label: "Currency",
        href: "/compliance/crew-currency",
        status: "live",
        department: "operations",
      },
      {
        id: "flight-log",
        label: "Flight Log",
        href: "/flight-crew/elog",
        status: "live",
        department: "operations",
      },
      {
        id: "roster",
        label: "Roster",
        href: "/compliance/roster",
        status: "live",
        department: "operations",
      },
      {
        id: "pilot-history",
        label: "Pilot History",
        href: "/flight-crew/history",
        status: "live",
        department: "operations",
      },
      {
        id: "village-wx",
        label: "Village Wx",
        href: "/village-wx",
        status: "live",
        department: "operations",
      },
      {
        id: "ramp-ops",
        label: "Ramp Ops",
        href: "/ramp-ops",
        status: "live",
        department: "operations",
      },
      {
        id: "eod",
        label: "EOD",
        href: "/eod",
        status: "live",
        department: "operations",
      },
      {
        id: "intelligence",
        label: "Intelligence",
        status: "m4",
        department: "operations",
        accent: "purple",
      },
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
      {
        id: "dashboard-executive",
        label: "Executive",
        href: "/dashboards/executive",
        status: "live",
        department: "admin",
      },
      {
        id: "dashboard-director-ops",
        label: "Dir. Ops",
        href: "/dashboards/director-ops",
        status: "live",
        department: "admin",
      },
      {
        id: "dashboard-chief-pilot",
        label: "Chief Pilot",
        href: "/dashboards/chief-pilot",
        status: "live",
        department: "admin",
      },
      {
        id: "dashboard-dispatcher",
        label: "Dispatch",
        href: "/dashboards/dispatcher",
        status: "live",
        department: "admin",
      },
      {
        id: "dashboard-station",
        label: "Station",
        href: "/dashboards/station",
        status: "live",
        department: "admin",
      },
      {
        id: "dashboard-ops-score",
        label: "Ops Score",
        href: "/dashboards/ops-score",
        status: "live",
        department: "admin",
      },
      {
        id: "dashboard-system",
        label: "System",
        href: "/dashboards/system-health",
        status: "live",
        department: "admin",
      },
      { id: "reports", label: "Reports", status: "m4", department: "admin" },
      {
        id: "reports-executive",
        label: "Executive",
        status: "m4",
        department: "admin",
      },
      {
        id: "reports-regulatory",
        label: "Regulatory",
        status: "m4",
        department: "admin",
      },
      {
        id: "reports-sim-export",
        label: "SIM Export",
        status: "m4",
        department: "admin",
      },
      { id: "reports-bi", label: "BI", status: "m4", department: "admin" },
      {
        id: "profitability",
        label: "Profitability",
        status: "m4",
        department: "admin",
      },
      {
        id: "invoicing",
        label: "Invoicing",
        status: "m4",
        department: "admin",
      },
      {
        id: "accounting",
        label: "Accounting",
        status: "m4",
        department: "admin",
      },
      {
        id: "fleetbrain",
        label: "Fleet Brain",
        status: "m4",
        department: "admin",
        accent: "purple",
        dividerBefore: true,
      },
      {
        id: "ops-brief",
        label: "Ops Brief",
        status: "m4",
        department: "admin",
        accent: "purple",
      },
      {
        id: "ai-query",
        label: "AI Query",
        status: "m4",
        department: "admin",
        accent: "purple",
      },
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
      {
        id: "academy-dashboard",
        label: "Dashboard",
        href: "/academy/dashboard",
        status: "live",
        department: "academy",
      },
      {
        id: "academy-course-library",
        label: "Course Library",
        href: "/academy",
        status: "live",
        department: "academy",
      },
      {
        id: "academy-assignments",
        label: "Assignments",
        href: "/academy/assignments",
        status: "live",
        department: "academy",
      },
      {
        id: "academy-certificates",
        label: "Certificates",
        href: "/academy/certificates",
        status: "live",
        department: "academy",
      },
      {
        id: "academy-reports",
        label: "Reports",
        href: "/academy/reports",
        status: "live",
        department: "academy",
      },
      {
        id: "academy-studio",
        label: "Studio",
        href: "/academy/studio",
        status: "live",
        department: "academy",
      },
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
    pathPrefixes: ["/reservations", "/customers", "/manifest"],
    /**
     * Sub-nav order matches legacy peregrineflight.com/reservations/:
     *   New Booking · Fleet Board · Customers · Charter · Rewards ·
     *   Accounting Export
     *
     * Legacy labelled the rewards tab with the operator's own program
     * name. Ours reads company_profile.rewards_program_name instead, so
     * the tab says whatever that tenant calls it.
     *
     * "New Booking" is the search-flights landing (mirrors the legacy
     * shopping-style form); "Fleet Board" is the day-grouped bookings
     * list (dispatcher view). Fares / Scripts from legacy are queued
     * for M3 follow-up (fare-class inventory + saved scripts).
     */
    children: [
      {
        id: "reservations-search",
        label: "New Booking",
        href: "/reservations",
        status: "live",
        department: "reservations",
      },
      {
        id: "reservations-board",
        label: "Fleet Board",
        href: "/reservations/fleet-board",
        status: "live",
        department: "reservations",
      },
      {
        id: "reservations-manifest",
        label: "Manifest",
        href: "/manifest",
        status: "live",
        department: "reservations",
      },
      {
        id: "reservations-customers",
        label: "Customers",
        href: "/customers",
        status: "live",
        department: "reservations",
      },
      {
        id: "reservations-charter",
        label: "Charter",
        href: "/reservations/charter",
        status: "live",
        department: "reservations",
      },
      // Label is generic ("Rewards") in the shared nav; the page
      // itself reads the per-tenant `rewards_program_name` off the
      // company profile and swaps it in. Per-tenant nav-label
      // rendering is deferred until the client-side session
      // hydrates with the profile.
      {
        id: "reservations-rewards",
        label: "Rewards",
        href: "/reservations/rewards",
        status: "live",
        department: "reservations",
      },
      {
        id: "reservations-acct-export",
        label: "Accounting Export",
        href: "/reservations/accounting-export",
        status: "live",
        department: "reservations",
      },
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
    pathPrefixes: [
      "/ground-ops",
      "/stations",
      "/equipment",
      "/fuel",
      "/ramper",
    ],
    children: [
      {
        id: "ground-ops-hub",
        label: "Hub",
        href: "/ground-ops",
        status: "live",
        department: "ground-ops",
      },
      {
        id: "stations",
        label: "Stations",
        href: "/stations",
        status: "live",
        department: "ground-ops",
      },
      {
        id: "equipment",
        label: "Equipment",
        href: "/equipment",
        status: "live",
        department: "ground-ops",
      },
      {
        id: "fuel",
        label: "Fuel",
        href: "/fuel",
        status: "live",
        department: "ground-ops",
      },
      {
        id: "suppliers",
        label: "Suppliers",
        href: "/fuel/suppliers",
        status: "live",
        department: "ground-ops",
      },
      {
        id: "ramper",
        label: "Ramper",
        href: "/ramper",
        status: "live",
        department: "ground-ops",
      },
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
      {
        id: "fleet",
        label: "Fleet",
        href: "/maintenance",
        status: "live",
        department: "maintenance",
      },
      {
        id: "work-orders",
        label: "Work Orders",
        href: "/maintenance/work-orders",
        status: "live",
        department: "maintenance",
      },
      {
        id: "rts",
        label: "RTS",
        href: "/maintenance/rts",
        status: "live",
        department: "maintenance",
      },
      {
        id: "inventory",
        label: "Inventory",
        href: "/maintenance/inventory",
        status: "live",
        department: "maintenance",
      },
      {
        id: "expiration",
        label: "Expiration",
        href: "/maintenance/expiration",
        status: "live",
        department: "maintenance",
      },
      {
        id: "batch-trace",
        label: "Batch Trace",
        href: "/maintenance/batch-trace",
        status: "live",
        department: "maintenance",
      },
      {
        id: "mx-clock",
        label: "MX Clock",
        href: "/maintenance/mx-clock",
        status: "live",
        department: "maintenance",
      },
      {
        id: "availability",
        label: "Availability",
        href: "/maintenance/availability",
        status: "live",
        department: "maintenance",
      },
      {
        id: "mx-intel",
        label: "MX Intel",
        status: "m4",
        department: "maintenance",
        accent: "purple",
      },
    ],
  },
  {
    id: "crew",
    label: "Crew",
    status: "m3",
    pathPrefixes: ["/crew-admin"],
    children: [
      { id: "crew-roster", label: "Roster", status: "m3", department: "crew" },
      {
        id: "duty-rest",
        label: "Duty & Rest",
        status: "m3",
        department: "crew",
      },
      { id: "training", label: "Training", status: "m3", department: "crew" },
      {
        id: "crew-payroll",
        label: "Payroll",
        status: "m3",
        department: "crew",
      },
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
      {
        id: "hr-employees",
        label: "HR",
        href: "/employees",
        status: "live",
        department: "hr",
      },
      {
        id: "hr-payroll",
        label: "Payroll",
        href: "/payroll",
        status: "live",
        department: "hr",
      },
      {
        id: "hr-time-clock",
        label: "Time Clock",
        href: "/time-clock",
        status: "live",
        department: "hr",
      },
      {
        id: "hr-records",
        label: "Records",
        href: "/compliance",
        status: "live",
        department: "hr",
      },
    ],
  },
  {
    id: "safety",
    label: "Safety",
    status: "live",
    // /documents is the Document Library (GOM, bulletins, FAR/AIM), which
    // hangs off Safety in the nav. Without it here the chip navigates
    // fine but the department row vanishes on arrival.
    pathPrefixes: ["/safety", "/documents"],
    children: [
      {
        id: "sms",
        label: "Safety SMS",
        href: "/safety",
        status: "live",
        department: "safety",
      },
      {
        id: "incidents",
        label: "Incidents",
        href: "/safety/incidents",
        status: "live",
        department: "safety",
      },
      {
        id: "actions",
        label: "Corrective Actions",
        href: "/safety/actions",
        status: "live",
        department: "safety",
      },
      {
        id: "my-reports",
        label: "My Reports",
        href: "/safety/mine",
        status: "live",
        department: "safety",
      },
      {
        id: "documents",
        label: "Documents",
        href: "/documents",
        status: "live",
        department: "safety",
      },
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
      {
        id: "settings-home",
        label: "Overview",
        href: "/settings",
        status: "live",
        department: "settings",
      },
      {
        id: "settings-users",
        label: "Users",
        href: "/settings/users",
        status: "live",
        department: "settings",
      },
      {
        id: "settings-company",
        label: "Company",
        href: "/settings/company",
        status: "live",
        department: "settings",
      },
      {
        id: "settings-bases",
        label: "Bases",
        href: "/settings/bases",
        status: "live",
        department: "settings",
      },
      {
        id: "settings-tracking",
        label: "Flight Tracking",
        href: "/settings/flight-tracking",
        status: "live",
        department: "settings",
      },
      {
        id: "settings-perms",
        label: "Permissions",
        href: "/settings/permissions",
        status: "live",
        department: "settings",
      },
      {
        id: "settings-sso",
        label: "SSO",
        href: "/settings/sso",
        status: "live",
        department: "settings",
      },
      // M3+ — placeholders matching the legacy sub-nav order. Each
      // becomes a real link once its surface ships.
      {
        id: "settings-costs",
        label: "Costs",
        href: "/settings/costs",
        status: "live",
        department: "settings",
      },
      {
        id: "settings-load",
        label: "Load Teams",
        href: "/settings/load-teams",
        status: "live",
        department: "settings",
      },
      {
        id: "settings-pilotpay",
        label: "Pilot Pay",
        href: "/settings/pilot-pay",
        status: "live",
        department: "settings",
      },
      {
        id: "settings-currency",
        label: "Currency",
        href: "/settings/currency",
        status: "live",
        department: "settings",
      },
      {
        id: "settings-billing",
        label: "Billing",
        href: "/settings/billing",
        status: "live",
        department: "settings",
      },
    ],
  },
  {
    id: "ai",
    label: "AI",
    status: "m4",
    pathPrefixes: ["/ai-tools"],
    children: [
      {
        id: "ai-fleetbrain",
        label: "Fleet Brain",
        status: "m4",
        department: "ai",
      },
      {
        id: "ai-morning-brief",
        label: "Morning Brief",
        status: "m4",
        department: "ai",
      },
      {
        id: "ai-safety-intelligence",
        label: "Safety Intelligence",
        status: "m4",
        department: "ai",
      },
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

// ---------------------------------------------------------------------------
// Role visibility
// ---------------------------------------------------------------------------

/**
 * Which roles see which department.
 *
 * Client request 8/25: "Each role should only have a view of the modules
 * that applies to their role. Pilots don't need to see reservations.
 * Reservations don't need to see flight ops."
 *
 * IMPORTANT — this is decluttering, not authorization. The backend's
 * require_role on every endpoint is the actual gate; hiding a nav chip
 * only stops someone tripping over a module that is not their job. Do not
 * add anything here and consider it secured.
 *
 * The two examples in the request map onto this table as follows:
 *   - pilots not seeing reservations: `reservations` omits pilot and
 *     crew_member, so the whole department disappears for them.
 *   - "reservations don't need to see flight ops": there is no
 *     reservations-agent role in the backend catalog today, only
 *     `dispatcher` — and a dispatcher unquestionably needs flight ops.
 *     So this half is NOT expressible yet. Raised with the operator; it
 *     needs a new role rather than a guess here.
 *
 * Departments not listed are visible to everyone.
 */
export const DEPARTMENT_ROLES: Partial<Record<DepartmentId, readonly Role[]>> =
  {
    // Dispatch, flight following, schedule, weather, currency, elog.
    // ground_ops is here for Ramp Ops and EOD, which live in this
    // department but are station work — see MODULE_ROLES below.
    operations: [
      "exec_admin",
      // Accountable for the operation — admitted to every department, and
      // named in every Operations module below because this department is
      // listed exhaustively.
      "director_of_operations",
      // Admitted to the department for the crew and currency modules only.
      // Checking a pilot and releasing a flight are different jobs, so the
      // dispatch and schedule modules leave the check airman out.
      "check_airman",
      "dispatcher",
      "chief_pilot",
      "pilot",
      "crew_member",
      "safety_officer",
      "ground_ops",
      // Admitted to the department for Flight Following ONLY — every other
      // module below names its own roles and leaves the agent out. See the
      // note above MODULE_ROLES.
      "reservations_agent",
    ],
    // Booking, manifests, customers, charter, rewards. Explicitly not
    // pilots or crew — the client's own example.
    reservations: [
      "exec_admin",
      "director_of_operations",
      "dispatcher",
      "reservations_agent",
    ],
    // director_of_maintenance for ground equipment, which is theirs.
    "ground-ops": [
      "exec_admin",
      "director_of_operations",
      "director_of_maintenance",
      "dispatcher",
      "ground_ops",
    ],
    maintenance: [
      "exec_admin",
      "director_of_operations",
      "director_of_maintenance",
      "chief_pilot",
      "maintenance",
      "safety_officer",
    ],
    crew: [
      "exec_admin",
      "director_of_operations",
      "chief_pilot",
      "check_airman",
      "pilot",
      "crew_member",
    ],
    // Deliberately everyone: training and checkrides apply to every role,
    // and a mechanic or ramper who cannot find their assigned course is a
    // compliance problem, not a tidier nav.
    academy: [...ROLES],
    // Also deliberately everyone. Hazard reporting has to be reachable by
    // whoever saw the hazard — gating SMS by job title is how near-misses
    // go unreported.
    safety: [...ROLES],
    hr: ["exec_admin", "director_of_operations"],
    // Reporting. The GOM puts running special reports at Level 2, which
    // is where the check airman and the DOM sit.
    admin: [
      "exec_admin",
      "director_of_operations",
      "director_of_maintenance",
      "dispatcher",
      "chief_pilot",
      "check_airman",
    ],
    // The GOM has Level 1 adding and archiving users and aircraft, and
    // names the DO there. The DOM is deliberately not included — an
    // operator who wants that grants Executive Admin alongside.
    settings: ["exec_admin", "director_of_operations"],
    ai: ["exec_admin", "director_of_operations"],
  };

/**
 * Per-module exceptions, for modules whose audience differs from their
 * department's. Anything absent inherits the department.
 */
export const MODULE_ROLES: Record<string, readonly Role[]> = {
  // Operations is listed exhaustively rather than half-explicit. A module
  // with no entry here inherits its department, and once reservations_agent
  // was admitted to Operations for Flight Following, inheritance would have
  // handed them Weather, Crew, Roster and the rest by omission. Naming every
  // module makes the omission impossible.
  //
  // The one thing the agent gets: a read-only board, so "where is my
  // flight?" does not become a phone call to dispatch. Everything else in
  // flight ops stays closed to them, per the client's 8/25 request.
  "flight-following": [
    "exec_admin",
    "director_of_operations",
    "dispatcher",
    "chief_pilot",
    "pilot",
    "crew_member",
    "safety_officer",
    "ground_ops",
    "reservations_agent",
  ],
  weather: [
    "exec_admin",
    "director_of_operations",
    "dispatcher",
    "chief_pilot",
    "pilot",
    "crew_member",
    "safety_officer",
    "ground_ops",
  ],
  crew: [
    "exec_admin",
    "director_of_operations",
    "dispatcher",
    "chief_pilot",
    "check_airman",
    "pilot",
    "crew_member",
  ],
  roster: [
    "exec_admin",
    "director_of_operations",
    "dispatcher",
    "chief_pilot",
    "check_airman",
    "pilot",
    "crew_member",
  ],
  "pilot-history": [
    "exec_admin",
    "director_of_operations",
    "chief_pilot",
    "check_airman",
    "pilot",
    "crew_member",
  ],
  "village-wx": [
    "exec_admin",
    "director_of_operations",
    "dispatcher",
    "chief_pilot",
    "pilot",
    "crew_member",
    "ground_ops",
  ],
  intelligence: [
    "exec_admin",
    "director_of_operations",
    "dispatcher",
    "chief_pilot",
  ],
  // Station-side work that happens to live under Operations.
  "ramp-ops": [
    "exec_admin",
    "director_of_operations",
    "dispatcher",
    "ground_ops",
    "chief_pilot",
  ],
  eod: [
    "exec_admin",
    "director_of_operations",
    "dispatcher",
    "ground_ops",
    "chief_pilot",
  ],
  // Release authority — not something a ramper or a crew member acts on.
  dispatch: [
    "exec_admin",
    "director_of_operations",
    "dispatcher",
    "chief_pilot",
  ],
  schedule: [
    "exec_admin",
    "director_of_operations",
    "dispatcher",
    "chief_pilot",
  ],
  // A pilot's own logbook and currency; ground_ops has no use for these.
  "flight-log": [
    "exec_admin",
    "director_of_operations",
    "chief_pilot",
    "check_airman",
    "pilot",
    "crew_member",
    "dispatcher",
  ],
  currency: [
    "exec_admin",
    "director_of_operations",
    "chief_pilot",
    "check_airman",
    "pilot",
    "crew_member",
    "dispatcher",
  ],
};

/**
 * True when a user holding `roles` should see `allowed`.
 *
 * Fails OPEN on an empty role list. A user whose roles failed to load
 * should get a cluttered nav, not an empty one — the backend still
 * refuses anything they may click, and stranding someone with no
 * navigation is a worse failure than showing them a module they cannot
 * use.
 */
function _permits(
  allowed: readonly Role[] | undefined,
  roles: readonly string[],
): boolean {
  if (!allowed) return true;
  if (roles.length === 0) return true;
  return roles.some((r) => (allowed as readonly string[]).includes(r));
}

/** Departments this user should see, in catalogue order. */
export function visibleDepartments(roles: readonly string[]): Department[] {
  return DEPARTMENTS.filter((d) => _permits(DEPARTMENT_ROLES[d.id], roles));
}

/** The modules within a department this user should see. */
export function visibleModules(
  dept: Department,
  roles: readonly string[],
): ModuleEntry[] {
  return dept.children.filter((m) => _permits(MODULE_ROLES[m.id], roles));
}

/** Whether this user should see the department a path belongs to. */
export function canSeeDepartment(
  dept: Department,
  roles: readonly string[],
): boolean {
  return _permits(DEPARTMENT_ROLES[dept.id], roles);
}
