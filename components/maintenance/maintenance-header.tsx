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
interface ActionButton {
  label: string;
  href?: string;
  primary?: boolean;
  status: "live" | "m3";
}

const ACTIONS: ActionButton[] = [
  { label: "Due List", status: "m3" },
  { label: "Work Orders", status: "m3" },
  { label: "Inspections", status: "m3" },
  { label: "Inventory", status: "m3" },
  { label: "Vendors", status: "m3" },
  { label: "RTS Queue", status: "m3" },
  { label: "🗓 Roster", status: "m3" },
  { label: "+ Aircraft", status: "m3", primary: true },
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
        {ACTIONS.map((action) => (
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
      ? "border border-status-blue bg-status-blue text-white hover:brightness-110"
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
