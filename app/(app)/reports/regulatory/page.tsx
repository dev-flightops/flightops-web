import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { cn } from "@/lib/utils";
/**
 * /reports/regulatory — the five filings.
 *
 * Legacy's `reports/regulatory_hub.html`, card for card and in its
 * order. The descriptions are legacy's, with two changes.
 *
 * Legacy's standfirst says the reports are "filterable by date range".
 * They are not, in either system: a filing period is a calendar month
 * or a quarter, and offering an arbitrary range would offer periods
 * that cannot be filed. Reworded rather than repeated.
 *
 * Legacy's DOT Form 41 card advertises "crew hours". That is the
 * figure its query gets wrong — it sums crew duty records, so a leg
 * flown by two crew counts twice. Ours reports aircraft block hours,
 * and the card says so.
 */

export const dynamic = "force-dynamic";

interface Filing {
  href: string;
  name: string;
  cadence: "Monthly" | "Quarterly";
  description: string;
}

const FILINGS: Filing[] = [
  {
    href: "/reports/regulatory/t100",
    name: "USPS T-100",
    cadence: "Monthly",
    description:
      "Air Carrier Statistics — mail volume by route and mail class for BTS reporting.",
  },
  {
    href: "/reports/regulatory/ps5500",
    name: "PS Form 5500",
    cadence: "Monthly",
    description:
      "USPS Air Contract Report — route completion rates, trips flown against trips scheduled, mail volume.",
  },
  {
    href: "/reports/regulatory/cam",
    name: "CAM Report",
    cadence: "Monthly",
    description:
      "Contract Air Mail Performance — on-time rates, cancellations and mail delivery per route.",
  },
  {
    href: "/reports/regulatory/form5394",
    name: "USPS Form 5394",
    cadence: "Monthly",
    description:
      "Air Carrier Mail Transport Documentation — flight-level records of mail carried, weights and pieces.",
  },
  {
    href: "/reports/regulatory/dot41",
    name: "DOT Form 41",
    cadence: "Quarterly",
    description:
      "Operating statistics — passengers, cargo, mail, quoted revenue, aircraft block hours and fleet.",
  },
];

export default function RegulatoryHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <PageHeader
        back={{ href: "/reports", label: "Reports" }}
        title="Regulatory Reports"
        description="FAA, USPS and DOT return generators. Each one covers a single filing period — a calendar month, or a quarter for Form 41 — and exports the same figures to CSV. The period defaults to the one just gone, because a period still in progress is not one anybody files."
      />

      {/* The filings as a list (#82), each a row with its cadence and what
          it covers, as the Reports directory lists its reports. */}
      <Panel flush>
        <ul className="divide-y divide-border">
          {FILINGS.map((f) => (
            <li key={f.href}>
              <Link
                href={f.href}
                className="flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-accent/40"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold text-foreground">{f.name}</span>
                    <span className="eyebrow">{f.cadence}</span>
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {f.description}
                  </span>
                </span>
                <span aria-hidden className={cn(linkCaps, "mt-0.5 shrink-0")}>
                  Open ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <p className="mt-6 max-w-2xl text-xs text-muted-foreground">
        Every mail figure is compiled from locked manifests only, and each
        report says how many drafts it skipped. Where something could not be
        measured — an arrival with no recorded time, a flight with no costed
        route — the reports say so rather than scoring it as a pass.
      </p>
    </div>
  );
}
