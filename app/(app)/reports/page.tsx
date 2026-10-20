import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { cn } from "@/lib/utils";

/**
 * /reports — the hub.
 *
 * Legacy has one of these and so does its regulatory section. Ours
 * exists for a smaller reason first: the executive summary needs
 * somewhere to go back to, and the Reports nav entry needs a
 * destination that is not a 404.
 *
 * Everything not built is listed rather than hidden. A hub showing one
 * link reads as a finished section with one report in it; a hub
 * showing one link and eight marked "not built" reads as what it is.
 * The M4 plan commits the executive suite and the regulatory filings,
 * so leaving them off the page would misstate the scope as much as
 * stubbing them would.
 */

export const metadata = { title: "Reports" };

interface Entry {
  label: string;
  detail: string;
  href?: string;
}

const EXECUTIVE: Entry[] = [
  {
    label: "Executive Summary",
    detail: "Revenue, cost, margin and unit economics, month to date",
    href: "/reports/executive/summary",
  },
  {
    label: "Profitability",
    detail: "Revenue against cost, by route and by aircraft",
    href: "/profitability",
  },
  {
    label: "Business Intelligence",
    detail: "Load factor, revenue per hour, seasonal demand, top customers",
    href: "/reports/bi",
  },
  // Trending, Customers and Efficiency used to sit here marked "Not
  // built", and their descriptions were "twelve-month revenue and
  // volume", "revenue concentration" and "load factor, utilisation".
  // Those are the four panels of the Business Intelligence report
  // above, so leaving them would claim three reports are missing whose
  // content shipped. Removed rather than relabelled: three cards
  // pointing at one page is a hub that has lost track of itself.
];

// All five are built now, so all five link. Four of the details were
// also wrong, written before the returns existed:
//
//   PS-5500 was "FAA operations report". It is a USPS air contract
//   report; the FAA is not involved.
//
//   CAM was "Continuous airworthiness maintenance", which is what CAM
//   means in a maintenance context and not what this report is. Here
//   it is Contract Air Mail — route performance against a mail
//   contract. A filer looking for maintenance records would have
//   opened it, and a filer looking for mail performance would not.
//
//   Form 5394 was "Aircraft utilisation". It is mail transport
//   documentation, one row per flight that carried mail.
//
//   DOT 41 was "Financial reporting schedule". Ours reports operating
//   statistics — traffic, block hours and fleet — with quoted revenue
//   alongside, not a financial schedule.
const REGULATORY: Entry[] = [
  {
    label: "T-100",
    detail: "Mail traffic by route and class, monthly",
    href: "/reports/regulatory/t100",
  },
  {
    label: "PS Form 5500",
    detail: "USPS air contract — trips flown against trips scheduled",
    href: "/reports/regulatory/ps5500",
  },
  {
    label: "CAM",
    detail: "Contract Air Mail — on-time and completion by route",
    href: "/reports/regulatory/cam",
  },
  {
    label: "USPS Form 5394",
    detail: "Mail transport records, one row per flight",
    href: "/reports/regulatory/form5394",
  },
  {
    label: "DOT Form 41",
    detail: "Quarterly operating statistics, traffic and fleet",
    href: "/reports/regulatory/dot41",
  },
];

// Its own section rather than a fourth Executive card or a sixth
// Regulatory one. It is neither: the three Executive entries are
// analytics read on screen, and the five Regulatory entries are
// government returns. This is an interchange file — a schedule
// published to OAG, or a departure list handed to an accounting
// system. Filing it under either heading would tell a reader it is
// something it is not, and one card in an honest section beats four in
// a misleading one.
const INTERCHANGE: Entry[] = [
  {
    label: "Schedule Export",
    detail: "SIM / OAG schedule data, and a per-departure extract",
    href: "/reports/sim",
  },
];

function Section({ title, entries }: { title: string; entries: Entry[] }) {
  // A section of the directory (#82), as Home lists the departments: each
  // report a row with what it shows under its name; one not built says so.
  return (
    <Panel title={title} flush className="mb-6">
      <ul className="divide-y divide-border">
        {entries.map((entry) => (
          <li key={entry.label}>
            {entry.href ? (
              <Link
                href={entry.href}
                className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-accent/40"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{entry.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{entry.detail}</span>
                </span>
                <span aria-hidden className={cn(linkCaps, "shrink-0")}>
                  Open ›
                </span>
              </Link>
            ) : (
              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-muted-foreground">{entry.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{entry.detail}</span>
                </span>
                <span className="status-mark shrink-0 text-muted-foreground">Not built</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default function ReportsHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader title="Reports" description="Executive analytics and regulatory filings" />
      <Section title="Executive" entries={EXECUTIVE} />
      <Section title="Regulatory" entries={REGULATORY} />
      <Section title="Interchange" entries={INTERCHANGE} />
    </div>
  );
}
