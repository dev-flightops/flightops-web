/**
 * Module catalogue — drives the AppShell's two-level navigation.
 *
 * Each top-level entry is a *department* (Operations, Maintenance, etc.).
 * Live departments expose sub-modules in their `children` array. Future
 * departments render as disabled chips in the primary nav with a tooltip
 * pointing at the milestone where they ship.
 *
 * Adding a new module:
 *   1. Add the entry under the right department's `children`.
 *   2. Set `status: "live"` and `href: "/your/route"`.
 *   3. The DepartmentNav picks it up automatically when the URL is on a
 *      sibling route.
 */

export type ModuleStatus = "live" | "m2" | "m3" | "m4";

export interface ModuleEntry {
  id: string;
  label: string;
  href?: string;
  status: ModuleStatus;
  /** Department this belongs to (also used to pick the active primary tab). */
  department: DepartmentId;
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
    pathPrefixes: ["/dispatch", "/dashboards"],
    /**
     * Order + selection mirrors the legacy form's sub-nav row exactly:
     *   Dispatch | Flight Following | Weather | Crew | Currency |
     *   Flight Log | Roster | Pilot History | Village Wx | Ramp Ops |
     *   EOD | ✨ Intelligence
     *
     * Dashboards isn't in the legacy top row — it still lives at
     * /dashboards for direct navigation but isn't surfaced here.
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
        status: "m2",
        department: "operations",
      },
      {
        id: "weather",
        label: "Weather",
        status: "m2",
        department: "operations",
      },
      {
        id: "crew",
        label: "Crew",
        status: "m3",
        department: "operations",
      },
      {
        id: "currency",
        label: "Currency",
        status: "m3",
        department: "operations",
      },
      {
        id: "flight-log",
        label: "Flight Log",
        status: "m2",
        department: "operations",
      },
      {
        id: "roster",
        label: "Roster",
        status: "m3",
        department: "operations",
      },
      {
        id: "pilot-history",
        label: "Pilot History",
        status: "m3",
        department: "operations",
      },
      {
        id: "village-wx",
        label: "Village Wx",
        status: "m2",
        department: "operations",
      },
      {
        id: "ramp-ops",
        label: "Ramp Ops",
        status: "m2",
        department: "operations",
      },
      {
        id: "eod",
        label: "EOD",
        status: "m2",
        department: "operations",
      },
      {
        id: "intelligence",
        label: "✨ Intelligence",
        status: "m4",
        department: "operations",
      },
    ],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    status: "m2",
    pathPrefixes: ["/maintenance"],
    children: [
      { id: "fleet", label: "Fleet", status: "m2", department: "maintenance" },
      {
        id: "work-orders",
        label: "Work Orders",
        status: "m2",
        department: "maintenance",
      },
      { id: "mel", label: "MEL", status: "m2", department: "maintenance" },
      {
        id: "squawks",
        label: "Squawks",
        status: "m2",
        department: "maintenance",
      },
    ],
  },
  {
    id: "crew",
    label: "Crew",
    status: "m3",
    pathPrefixes: ["/crew"],
    children: [
      { id: "roster", label: "Roster", status: "m3", department: "crew" },
      {
        id: "duty-rest",
        label: "Duty & Rest",
        status: "m3",
        department: "crew",
      },
      {
        id: "training",
        label: "Training",
        status: "m3",
        department: "crew",
      },
      {
        id: "payroll",
        label: "Payroll",
        status: "m3",
        department: "crew",
      },
    ],
  },
  {
    id: "safety",
    label: "Safety",
    status: "m3",
    pathPrefixes: ["/safety"],
    children: [
      {
        id: "sms",
        label: "Safety SMS",
        status: "m3",
        department: "safety",
      },
      {
        id: "documents",
        label: "Documents",
        status: "m3",
        department: "safety",
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    status: "m4",
    pathPrefixes: ["/admin", "/settings"],
    children: [
      {
        id: "billing",
        label: "Billing",
        status: "m4",
        department: "admin",
      },
      {
        id: "reports",
        label: "Reports",
        status: "m4",
        department: "admin",
      },
      {
        id: "audit",
        label: "Audit Log",
        status: "m4",
        department: "admin",
      },
    ],
  },
  {
    id: "ai",
    label: "AI",
    status: "m4",
    pathPrefixes: ["/ai", "/fleetbrain"],
    children: [
      {
        id: "fleetbrain",
        label: "Fleet Brain",
        status: "m4",
        department: "ai",
      },
      {
        id: "morning-brief",
        label: "Morning Brief",
        status: "m4",
        department: "ai",
      },
      {
        id: "safety-intelligence",
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
