import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";

/**
 * The shortcut row at the foot of the home page (legacy's `.dash-strip`),
 * set as ForeFlight's caps links since #79. Legacy's gold Settings is gone:
 * the brief asks for one accent.
 *
 * Each entry can be `live` (renders as Link) or any future milestone
 * (renders as a non-interactive span with a tooltip).
 */

import type { Role } from "@/lib/roles";

import type { ModuleStatus } from "./module-catalog";
import { moduleStatusHint } from "./module-catalog";

export interface QuickLink {
  label: string;
  href: string;
  status: ModuleStatus;
  /** Roles that see this link. Absent means everyone. Kept in step with
   *  DEPARTMENT_ROLES / MODULE_ROLES in components/app-shell/modules.ts —
   *  a shortcut into a module the nav hides is the same bug twice. */
  roles?: readonly Role[];
}

// Order matches legacy peregrineflight's /home dash-strip verbatim.
export const HOME_QUICK_LINKS: QuickLink[] = [
  {
    label: "EOD Closeout",
    href: "/eod",
    status: "live",
    roles: ["exec_admin", "dispatcher", "ground_ops", "chief_pilot"],
  },
  {
    // Shipped as /reports/bi. This entry carried both an "m4" status
    // and an href at /reports/executive/bi that never existed — so
    // even once the status was corrected the link would have 404'd.
    label: "Business Intelligence",
    href: "/reports/bi",
    status: "live",
    roles: ["exec_admin", "director_of_operations"],
  },
  {
    label: "Invoices",
    href: "/invoicing",
    status: "live",
    // Same audience as the nav entry and the service: raising and
    // sending an invoice is the office's job. The DO and the company's
    // bookkeeper (#128) are admitted here as well as the exec admin,
    // matching MODULE_ROLES.invoicing.
    roles: ["exec_admin", "director_of_operations", "accountant"],
  },
  // "My" anything — a logbook, a duty history — only means something to
  // someone who flies. Kept in step with the flight-log and currency
  // entries in MODULE_ROLES.
  {
    label: "My Flight History",
    href: "/flight-crew/history?tab=flight",
    status: "live",
    roles: ["exec_admin", "chief_pilot", "pilot", "crew_member"],
  },
  {
    label: "My Duty History",
    href: "/flight-crew/history?tab=duty",
    status: "live",
    roles: ["exec_admin", "chief_pilot", "pilot", "crew_member"],
  },
  {
    label: "Flight Log",
    href: "/flight-crew/elog",
    status: "live",
    roles: ["exec_admin", "chief_pilot", "pilot", "crew_member", "dispatcher"],
  },
  // Settings is entirely company configuration — users, SSO, billing,
  // branding, fleet. There is no personal-profile page behind it, so
  // restricting it strands nobody.
  {
    label: "Settings",
    href: "/settings",
    status: "live",
    roles: ["exec_admin"],
  },
];

export function QuickLinks({ links }: { links: QuickLink[] }) {
  if (links.length === 0) return null;

  // Shortcuts as ForeFlight's caps links (#79), in a row under a label.
  return (
    <nav aria-label="Shortcuts" className="mt-10 border-t border-border pt-5">
      <p className="eyebrow mb-3">Shortcuts</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {links.map((link) => (
          <QuickLinkItem key={link.label} link={link} />
        ))}
      </div>
    </nav>
  );
}

function QuickLinkItem({ link }: { link: QuickLink }) {
  if (link.status === "live") {
    return (
      <Link href={link.href} className={linkCaps}>
        {link.label}
      </Link>
    );
  }
  return (
    <span
      className={cn(linkCaps, "cursor-not-allowed text-muted-foreground hover:no-underline")}
      aria-disabled="true"
      title={moduleStatusHint(link.status) ?? undefined}
    >
      {link.label}
    </span>
  );
}
