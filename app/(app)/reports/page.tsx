import Link from "next/link";

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
  return (
    <section aria-label={title} className="mb-6">
      <h2 className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {entries.map((entry) => (
          <li key={entry.label}>
            {entry.href ? (
              <Link
                href={entry.href}
                className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <p className="text-sm font-semibold">{entry.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {entry.detail}
                </p>
              </Link>
            ) : (
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  {entry.label}
                  <span className="rounded border border-border px-1.5 py-0.5 text-[0.55rem] uppercase tracking-wider">
                    Not built
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground/70">
                  {entry.detail}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ReportsHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Executive analytics and regulatory filings
        </p>
      </header>
      <Section title="Executive" entries={EXECUTIVE} />
      <Section title="Regulatory" entries={REGULATORY} />
      <Section title="Interchange" entries={INTERCHANGE} />
    </div>
  );
}
