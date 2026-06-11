import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listOpenStationIssues, listStations } from "@/lib/api/ground";

/**
 * /ground-ops — Ground Operations hub (M2-G-38 rebuild).
 *
 * Mirrors legacy `templates/ground_ops/hub.html`:
 *   - Title + subtitle
 *   - Stats strip (Stations · Open Issues · GSE Units · GSE Down · Pending Fuel)
 *     — only Stations + Open Issues are live today, the rest render
 *     placeholders with "—" until their backends ship in M2-M-25b…c
 *   - Section cards: Stations (live), Ramp Operations, Ground Support
 *     Equipment, Fuel Management — placeholder targets for the M2 stories
 *     that ship those routes
 */
export default async function GroundOpsHubPage() {
  let stationCount = 0;
  let openIssueCount = 0;
  let loadError: string | null = null;

  try {
    const [stations, issues] = await Promise.all([
      listStations({ limit: 500 }),
      listOpenStationIssues({ status: "open", limit: 1 }),
    ]);
    stationCount = stations.total;
    openIssueCount = issues.total;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Ground Ops data unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Ground Operations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ramp operations, station management, and ground support equipment
        </p>
      </header>

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Stations" value={stationCount} />
        <StatTile
          label="Open Issues"
          value={openIssueCount}
          accent={openIssueCount > 0 ? "yellow" : undefined}
        />
        <StatTile label="GSE Units" value="—" />
        <StatTile label="GSE Down" value="—" />
        <StatTile label="Pending Fuel" value="—" />
        <StatTile label="Flights Today" value="—" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <SectionCard
          icon="📍"
          title="Station Management"
          blurb="Airport and base master data. Runway information, station issues, and operational notes."
          links={[
            {
              label: "All Stations",
              sublabel: `${stationCount} stations configured`,
              href: "/stations",
            },
            {
              label: "Station Issues",
              sublabel: "Runway, facility, and ops issues",
              href: "/stations",
              badge:
                openIssueCount > 0
                  ? { text: `${openIssueCount} open`, tone: "red" }
                  : undefined,
            },
          ]}
        />
        <SectionCard
          icon="✈️"
          title="Ramp Operations"
          blurb="Mobile-optimized flight board for ramp agents. Track turnarounds, confirm loads, capture photos."
          comingIn="M2"
        />
        <SectionCard
          icon="🚛"
          title="Ground Support Equipment"
          blurb="Equipment inventory, service tracking, and squawk management for tugs, GPUs, fuel trucks."
          comingIn="M2"
        />
        <SectionCard
          icon="⛽"
          title="Fuel Management"
          blurb="Order fuel, manage suppliers, track pricing, view fuel reports across all bases."
          comingIn="M2"
        />
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "yellow" | "red";
}) {
  const valueClass =
    accent === "yellow"
      ? "text-status-yellow"
      : accent === "red"
        ? "text-status-red"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-center">
      <div className={`text-2xl font-bold leading-none ${valueClass}`}>
        {value}
      </div>
      <div className="mt-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

interface SectionLink {
  label: string;
  sublabel?: string;
  href: string;
  badge?: { text: string; tone: "red" | "yellow" };
}

function SectionCard({
  icon,
  title,
  blurb,
  links,
  comingIn,
}: {
  icon: string;
  title: string;
  blurb: string;
  links?: SectionLink[];
  comingIn?: "M2" | "M3" | "M4";
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="mb-2 text-xl">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
      {links ? (
        <ul className="mt-3 space-y-1.5">
          {links.map((link) => (
            <li key={`${link.label}-${link.href}`}>
              <Link
                href={link.href}
                className="flex items-center justify-between rounded-md border border-border bg-card/40 px-3 py-2.5 text-sm text-foreground hover:border-status-blue/60 hover:bg-status-blue/5"
              >
                <span>
                  <span className="font-semibold">{link.label}</span>
                  {link.sublabel && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {link.sublabel}
                    </span>
                  )}
                </span>
                {link.badge ? (
                  <span
                    className={
                      link.badge.tone === "red"
                        ? "rounded-md border border-status-red/40 bg-status-red/10 px-2 py-0.5 text-[0.65rem] font-semibold text-status-red"
                        : "rounded-md border border-status-yellow/40 bg-status-yellow/10 px-2 py-0.5 text-[0.65rem] font-semibold text-status-yellow"
                    }
                  >
                    {link.badge.text}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">→</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 inline-block rounded-md border border-border bg-card/60 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Coming in {comingIn}
        </p>
      )}
    </article>
  );
}
