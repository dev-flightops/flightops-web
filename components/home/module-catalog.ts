import type { Role } from "@/lib/roles";

/**
 * The home page's entries — one per legacy `mod-card` from
 * `dispatch-platform-main/templates/home.html`, with legacy's label and
 * sub-label copy (verbatim) and the route it opens.
 *
 * Since #79 the home shows them as a directory under their departments,
 * as words; legacy's icon paths and colour families went with the tiles.
 *
 * `status` controls whether an entry is a link:
 *   live  → renders as a Link to `href`
 *   m2|m3|m4|planned → muted, marked "Soon", with a "Coming in Mx" title
 *              (the user's request: show unshipped modules, disabled,
 *              rather than hide them)
 */

export type ModuleStatus = "live" | "m2" | "m3" | "m4" | "planned";

export interface HomeModule {
  id: string;
  label: string;
  sub: string;
  href: string;
  status: ModuleStatus;
  /** When set, the tile only renders for users whose `session.roles`
   * includes this string. Used for external / role-scoped surfaces
   * like the supplier portal — invisible to everyone else. */
  roleGate?: string;
}

export const HOME_MODULES: HomeModule[] = [
  {
    id: "flight-crew",
    label: "Flight Crew",
    sub: "Schedule, duty, weather, aircraft",
    href: "/flight-crew",
    status: "live",
  },
  {
    id: "reservations",
    label: "Reservations",
    sub: "Fleet Board, bookings, customers, billing",
    href: "/reservations/",
    status: "live",
  },
  {
    id: "dispatch",
    label: "Dispatch",
    sub: "Release, weather, crew, following",
    href: "/dispatch",
    status: "live",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    sub: "Aircraft, squawks, MEL",
    href: "/maintenance",
    status: "live",
  },
  {
    id: "ground-ops",
    label: "Ground Operations",
    sub: "Ramp, stations, GSE, fuel",
    href: "/ground-ops/",
    status: "live",
  },
  {
    id: "hr",
    label: "HR",
    sub: "Employees & payroll",
    href: "/employees/",
    status: "live",
  },
  {
    id: "academy",
    label: "Academy",
    sub: "Training & courses",
    href: "/academy/",
    status: "live",
  },
  {
    id: "compliance",
    label: "Records and Compliance",
    sub: "FAR, safety, regulatory checks",
    href: "/compliance/crew-currency",
    status: "live",
  },
  {
    id: "safety",
    label: "Safety",
    sub: "Reports, hazards, incidents, SMS",
    href: "/safety/",
    status: "live",
  },
  {
    id: "admin",
    label: "Admin",
    sub: "Dashboards, analytics, users",
    href: "/dashboards",
    status: "live",
  },
  {
    id: "documents",
    label: "Documents",
    sub: "GOM, bulletins, FAR/AIM",
    href: "/documents",
    status: "live",
  },
  {
    id: "flight-following",
    label: "Flight Following",
    sub: "Live ops board, tracking, history",
    href: "/flight-following",
    status: "live",
  },
  {
    id: "housing",
    label: "Housing",
    sub: "Crew housing, rooms, assignments",
    href: "/housing/",
    status: "live",
  },
  {
    id: "invoicing",
    label: "Invoicing",
    sub: "Flight invoices, billing, AR",
    href: "/invoicing",
    status: "live",
  },
  {
    id: "fuel-supplier",
    label: "Fuel Supplier Portal",
    sub: "Incoming orders — acknowledge and complete",
    href: "/fuel/supplier",
    status: "live",
    roleGate: "fuel_supplier",
  },
  {
    id: "fleetbrain",
    label: "Fleet Brain",
    sub: "AI ops assistant — ask anything",
    href: "/fleetbrain",
    status: "live",
  },
];

export function moduleStatusHint(status: ModuleStatus): string | null {
  if (status === "live") return null;
  if (status === "planned") return "Not built yet";
  return `Coming in ${status.toUpperCase()}`;
}

/**
 * Which roles see which home tile.
 *
 * Same intent as DEPARTMENT_ROLES in components/app-shell/modules.ts —
 * client request 8/25, "each role should only have a view of the modules
 * that applies to their role" — but keyed by home-tile id, because the
 * home grid and the department nav do not have the same entries.
 *
 * Decluttering, not authorization: every page behind these tiles enforces
 * its own access server-side. Tiles absent from this map are visible to
 * everyone; `roleGate` on an individual module still applies on top.
 */
export const HOME_MODULE_ROLES: Record<string, readonly Role[]> = {

  "flight-crew": [
    "exec_admin",
    "director_of_operations",
    "chief_pilot",
    "check_airman",
    "pilot",
    "crew_member",
    "dispatcher",
  ],
  // The client's own example: pilots don't need reservations.
  reservations: [
    "exec_admin",
    "director_of_operations",
    "dispatcher",
    "reservations_agent",
  ],
  dispatch: [
    "exec_admin",
    "director_of_operations",
    "dispatcher",
    "chief_pilot",
  ],
  // Read-only board so an agent can answer "where is my flight?" without
  // interrupting dispatch. The tile is the only flight-ops surface they get.
  "flight-following": [
    "exec_admin",
    "director_of_operations",
    "director_of_maintenance",
    "dispatcher",
    "chief_pilot",
    "pilot",
    "reservations_agent",
  ],
  maintenance: [
    "exec_admin",
    "director_of_operations",
    "director_of_maintenance",
    "chief_pilot",
    "maintenance",
    "safety_officer",
  ],
  "ground-ops": [
    "exec_admin",
    "director_of_operations",
    "director_of_maintenance",
    "dispatcher",
    "ground_ops",
  ],
  hr: ["exec_admin", "director_of_operations"],
  housing: ["exec_admin", "director_of_operations", "ground_ops"],
  // Matches billing-service's customer-invoice routes plus
  // MODULE_ROLES.invoicing. Raising and sending an invoice is the
  // office's job, the company's bookkeeper's included (#128); voiding one
  // is a financial correction.
  invoicing: ["exec_admin", "director_of_operations", "accountant"],
  compliance: [
    "exec_admin",
    "director_of_operations",
    "chief_pilot",
    "check_airman",
    "safety_officer",
    "dispatcher",
  ],
  documents: [
    "exec_admin",
    "director_of_operations",
    "director_of_maintenance",
    "chief_pilot",
    "safety_officer",
    "maintenance",
    "dispatcher",
  ],
  // FleetBrain answers across crew, maintenance, flights and weather,
  // so the tile goes to everyone who would act on any of those. It is
  // a shortcut, not a gate: the page itself is open to any signed-in
  // user, matching the service, which in turn matches the endpoints it
  // reads — /compliance/board carries no role dependency either. There
  // is nothing here the asker could not already read off a dashboard.
  fleetbrain: [
    "exec_admin",
    "director_of_operations",
    "director_of_maintenance",
    "chief_pilot",
    "check_airman",
    "safety_officer",
    "dispatcher",
    "maintenance",
  ],
  // academy and safety are deliberately absent: training applies to
  // everyone, and hazard reporting must be reachable by whoever saw the
  // hazard. See the note in components/app-shell/modules.ts.
};


/**
 * Whether a session's roles can see a module — the rule the home tiles
 * use, exported so the top bar's Ops chip follows it too rather than
 * keeping a second copy.
 *
 * Fails open on an empty role list, as the tiles do. A login with no
 * staff role never gets this far any more — it is a customer or a
 * supplier's rep, and it gets the portal (lib/external-access.ts).
 */
export function rolesCanSeeModule(
  moduleId: string,
  roles: readonly string[],
): boolean {
  const allowed = HOME_MODULE_ROLES[moduleId];
  if (!allowed || roles.length === 0) return true;
  return roles.some((r) => (allowed as readonly string[]).includes(r));
}
