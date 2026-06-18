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

import type { ModuleStatus } from "./module-catalog";
import { moduleStatusHint } from "./module-catalog";

export interface QuickLink {
  label: string;
  href: string;
  status: ModuleStatus;
  /** Optional color emphasis. Currently only "gold" used (for Settings). */
  accent?: "gold";
}

// Order matches legacy peregrineflight's /home dash-strip verbatim.
// For the M1 demo deploy only Settings stays live (it's the Admin-side
// shortcut that pairs with the Admin card above). EOD Closeout +
// Flight Log are M2 work — flip back to "live" when the deploy
// promotes past M1.
export const HOME_QUICK_LINKS: QuickLink[] = [
  { label: "EOD Closeout", href: "/eod", status: "m2" },
  { label: "Business Intelligence", href: "/reports/executive/bi", status: "m4" },
  { label: "Invoices", href: "/invoicing/", status: "m4" },
  { label: "My Flight History", href: "/crew/my-history/flights", status: "m3" },
  { label: "My Duty History", href: "/crew/my-history/duty", status: "m3" },
  { label: "Flight Log", href: "/flight-log", status: "m2" },
  { label: "Settings", href: "/settings", status: "live", accent: "gold" },
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
