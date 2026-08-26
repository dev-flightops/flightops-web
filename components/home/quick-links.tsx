import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Bottom shortcut strip on the home page. Pixel-match for the legacy
 * `.dash-strip`: top border separator, centered chips, tiny uppercase-ish
 * copy.
 *
 * Each entry can be `live` (renders as Link) or any future milestone
 * (renders as a non-interactive span with a tooltip). Settings in the
 * legacy is highlighted gold — preserved here via `accent: "gold"`.
 */

import type { Role } from "@/lib/roles";

import type { ModuleStatus } from "./module-catalog";
import { moduleStatusHint } from "./module-catalog";

export interface QuickLink {
  label: string;
  href: string;
  status: ModuleStatus;
  /** Optional color emphasis. Currently only "gold" used (for Settings). */
  accent?: "gold";
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
    label: "Business Intelligence",
    href: "/reports/executive/bi",
    status: "m4",
    roles: ["exec_admin"],
  },
  {
    label: "Invoices",
    href: "/invoicing/",
    status: "m4",
    roles: ["exec_admin"],
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
    accent: "gold",
    roles: ["exec_admin"],
  },
];

export function QuickLinks({ links }: { links: QuickLink[] }) {
  if (links.length === 0) return null;

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-2 border-t border-border pt-6">
      {links.map((link) => (
        <QuickLinkChip key={link.label} link={link} />
      ))}
    </div>
  );
}

function QuickLinkChip({ link }: { link: QuickLink }) {
  const isLive = link.status === "live";
  const className = cn(
    "rounded-md px-2.5 py-1.5 text-[0.68rem] font-semibold tracking-[0.02em] transition-colors",
    isLive
      ? "text-muted-foreground hover:bg-primary/8 hover:text-status-blue"
      : "cursor-not-allowed text-muted-foreground/50",
    link.accent === "gold" && isLive && "text-status-yellow",
    link.accent === "gold" && !isLive && "text-status-yellow/40",
  );

  if (isLive) {
    return (
      <Link href={link.href} className={className}>
        {link.label}
      </Link>
    );
  }

  return (
    <span
      className={className}
      aria-disabled="true"
      title={moduleStatusHint(link.status) ?? undefined}
    >
      {link.label}
    </span>
  );
}
