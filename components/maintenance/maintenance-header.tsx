import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Maintenance landing header (M2-G-22b).
 *
 * Mirrors legacy `templates/maintenance/dashboard.html` line 4-20:
 *
 *   Fleet Management                         [Due List] [Work Orders] …
 *   Aircraft, maintenance, work orders, and vendors                  [+ Aircraft]
 *
 * 7 of the 8 action buttons point at sub-modules that aren't built
 * yet (M3). They render as visually-styled disabled spans with a
 * "Coming in M3" tooltip — same pattern the DepartmentNav uses —
 * so the layout matches legacy without any of the buttons leading
 * to a 404. `+ Aircraft` is the only enabled-looking entry; the
 * route also lands in M3, so it stays disabled too until the
 * aircraft-create form ships.
 */
export interface ActionButton {
  label: string;
  href?: string;
  primary?: boolean;
  status: "live" | "m3";
}

// Five of these shipped and stayed dimmed here. The department nav
// links them; this header, which is what somebody standing on
// /maintenance actually reaches for, still said "Coming in M3".
//
// "Due List" is /maintenance/expiration — that page IS the due list,
// under the name the nav gives it. Relabelled rather than left
// pointing at nothing, because two names for one page is how a hub
// ends up with a dead entry beside a live one.
//
// Inspections, Vendors and Roster have no page and stay dimmed.
// Exported for components/home/module-status.test.ts, which sweeps
// every catalogue in the app for a status that disagrees with what
// is on disk. This one sat outside that sweep, which is how five
// shipped pages stayed dimmed here.
export const MAINTENANCE_ACTIONS: ActionButton[] = [
  { label: "Squawks", href: "/maintenance/squawks", status: "live" },
  { label: "MEL", href: "/maintenance/mel", status: "live" },
  // Legacy's "Due List" is the maintenance-due list, which is our
  // Maintenance Clock — "track aircraft maintenance time with
  // milestones". Pointed at /maintenance/expiration first, which is
  // the *parts* shelf-life report and a different question
  // altogether; the route existed so the guard was satisfied, and
  // only opening the page showed it. The department nav calls this
  // same page "MX Clock" — one page, two labels, because this header
  // mirrors legacy's wording.
  { label: "Due List", href: "/maintenance/mx-clock", status: "live" },
  { label: "Work Orders", href: "/maintenance/work-orders", status: "live" },
  { label: "Inventory", href: "/maintenance/inventory", status: "live" },
  { label: "RTS Queue", href: "/maintenance/rts", status: "live" },
  { label: "Inspections", status: "m3" },
  { label: "Vendors", status: "m3" },
  { label: "Roster", status: "m3" },
  // Adding a tail lives under Settings -> Fleet, where AddAircraftDialog
  // has called createAircraftAction since M2. This entry sat dimmed as
  // `m3` with the note "an add form we never built" — it was built, just
  // not at a /maintenance route, and having no href kept it outside
  // module-status.test.ts, which can only check a status against a route.
  { label: "+ Aircraft", href: "/settings/fleet", status: "live", primary: true },
];

export function MaintenanceHeader() {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
          Fleet Management
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Aircraft, maintenance, work orders, and vendors
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {MAINTENANCE_ACTIONS.map((action) => (
          <ActionLink key={action.label} action={action} />
        ))}
      </div>
    </header>
  );
}

function ActionLink({ action }: { action: ActionButton }) {
  const baseClass = cn(
    "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
    action.primary
      ? "border border-primary bg-primary text-white hover:bg-brand-dark"
      : "border border-border bg-card text-foreground hover:bg-muted/40",
    action.status !== "live" && "cursor-not-allowed opacity-50 hover:bg-card",
  );

  if (action.status === "live" && action.href) {
    return (
      <Link href={action.href} className={baseClass}>
        {action.label}
      </Link>
    );
  }

  return (
    <span
      role="button"
      aria-disabled="true"
      title="Coming in M3"
      className={baseClass}
    >
      {action.label}
    </span>
  );
}
