import Link from "next/link";

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
  /** Tailwind text colour for the cadence chip, matching legacy's
   *  per-card accent. */
  accent: string;
}

const FILINGS: Filing[] = [
  {
    href: "/reports/regulatory/t100",
    name: "USPS T-100",
    cadence: "Monthly",
    description:
      "Air Carrier Statistics — mail volume by route and mail class for BTS reporting.",
    accent: "text-status-blue",
  },
  {
    href: "/reports/regulatory/ps5500",
    name: "PS Form 5500",
    cadence: "Monthly",
    description:
      "USPS Air Contract Report — route completion rates, trips flown against trips scheduled, mail volume.",
    accent: "text-status-green",
  },
  {
    href: "/reports/regulatory/cam",
    name: "CAM Report",
    cadence: "Monthly",
    description:
      "Contract Air Mail Performance — on-time rates, cancellations and mail delivery per route.",
    accent: "text-status-yellow",
  },
  {
    href: "/reports/regulatory/form5394",
    name: "USPS Form 5394",
    cadence: "Monthly",
    description:
      "Air Carrier Mail Transport Documentation — flight-level records of mail carried, weights and pieces.",
    accent: "text-status-blue",
  },
  {
    href: "/reports/regulatory/dot41",
    name: "DOT Form 41",
    cadence: "Quarterly",
    description:
      "Operating statistics — passengers, cargo, mail, quoted revenue, aircraft block hours and fleet.",
    accent: "text-status-green",
  },
];

export default function RegulatoryHubPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/reports"
        className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        ← Reports
      </Link>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
        Regulatory Reports
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        FAA, USPS and DOT return generators. Each one covers a single filing
        period — a calendar month, or a quarter for Form 41 — and exports the
        same figures to CSV. The period defaults to the one just gone, because
        a period still in progress is not one anybody files.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FILINGS.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-status-blue"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold text-foreground">{f.name}</h2>
              <span
                className={`text-[0.65rem] font-semibold uppercase tracking-wider ${f.accent}`}
              >
                {f.cadence}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {f.description}
            </p>
          </Link>
        ))}
      </div>

      <p className="mt-6 max-w-2xl text-xs text-muted-foreground">
        Every mail figure is compiled from locked manifests only, and each
        report says how many drafts it skipped. Where something could not be
        measured — an arrival with no recorded time, a flight with no costed
        route — the reports say so rather than scoring it as a pass.
      </p>
    </div>
  );
}
