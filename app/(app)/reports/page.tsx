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
  { label: "Profitability", detail: "By route and by aircraft" },
  { label: "Trending", detail: "Twelve-month revenue and volume" },
  { label: "Customers", detail: "Revenue concentration and repeat business" },
  { label: "Efficiency", detail: "Load factor, utilisation, empty legs" },
];

const REGULATORY: Entry[] = [
  { label: "T-100", detail: "DOT segment and market traffic" },
  { label: "PS-5500", detail: "FAA operations report" },
  { label: "CAM", detail: "Continuous airworthiness maintenance" },
  { label: "Form 5394", detail: "Aircraft utilisation" },
  { label: "DOT 41", detail: "Financial reporting schedule" },
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
                className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-status-blue/50"
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
    </div>
  );
}
