import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  listGseUnits,
  listOpenStationIssues,
  listStations,
} from "@/lib/api/ground";

/**
 * /ground-ops — Ground Operations hub.
 *
 * Mirrors legacy `templates/ground_ops/hub.html`:
 *   - Title + subtitle (verbatim)
 *   - 6-tile stats strip in legacy order: Flights Today · Stations ·
 *     Pending Fuel · GSE Units · GSE Down · Open Issues
 *   - 3-column card grid with Fuel Management wrapping below: Ramp Ops ·
 *     Station Management · Ground Support Equipment · Fuel Management
 *   - Each card lists the same sub-links the legacy renders; sub-links
 *     to routes that aren't built yet render as dimmed "Coming in Mx"
 *     entries (matches our chip pattern in the dept subnav).
 */
export default async function GroundOpsHubPage() {
  let stationCount = 0;
  let openIssueCount = 0;
  let gseTotal = 0;
  let gseDown = 0;
  let loadError: string | null = null;

  try {
    const [stations, issues, gse] = await Promise.all([
      listStations({ limit: 500 }),
      listOpenStationIssues({ status: "open", limit: 1 }),
      listGseUnits({ limit: 500 }),
    ]);
    stationCount = stations.total;
    openIssueCount = issues.total;
    gseTotal = gse.total;
    gseDown = gse.items.filter(
      (u) => u.status === "maintenance" || u.status === "out_of_service",
    ).length;
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
        <StatTile label="Flights Today" value={0} />
        <StatTile label="Stations" value={stationCount} />
        <StatTile label="Pending Fuel" value={0} />
        <StatTile label="GSE Units" value={gseTotal} />
        <StatTile
          label="GSE Down"
          value={gseDown}
          accent={gseDown > 0 ? "red" : undefined}
        />
        <StatTile
          label="Open Issues"
          value={openIssueCount}
          accent={openIssueCount > 0 ? "yellow" : undefined}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          icon="✈️"
          title="Ramp Operations"
          blurb="Mobile-optimized flight board for ramp agents. Track turnarounds, confirm loads, capture photos, manage fuel orders."
          links={[
            {
              label: "Ramp Dashboard",
              sublabel: "Flight board, turnaround timers",
              href: "/ramper",
              status: "m2",
            },
            {
              label: "Fuel Orders",
              sublabel: "Confirm and complete fuel deliveries",
              href: "/ramper/fuel-orders",
              status: "m2",
            },
            {
              label: "Ramp Messages",
              sublabel: "Base-level communication channel",
              href: "/ramper/messages",
              status: "m2",
            },
          ]}
        />
        <SectionCard
          icon="📍"
          title="Station Management"
          blurb="Airport and base master data. Runway information, station issues, and operational notes."
          links={[
            {
              label: "All Stations",
              sublabel: `${stationCount} stations configured`,
              href: "/stations",
              status: "live",
            },
            {
              label: "Station Issues",
              sublabel: "Runway, facility, and ops issues",
              href: "/stations",
              status: "live",
              badge:
                openIssueCount > 0
                  ? { text: `${openIssueCount} open`, tone: "red" }
                  : undefined,
            },
            {
              label: "Add Station",
              sublabel: "Register a new ICAO station",
              href: "/stations/new",
              status: "m2",
            },
          ]}
        />
        <SectionCard
          icon="🚛"
          title="Ground Support Equipment"
          blurb="Equipment inventory, service tracking, and squawk management for tugs, GPUs, fuel trucks, and more."
          links={[
            {
              label: "Equipment Dashboard",
              sublabel: `${gseTotal} units${gseDown > 0 ? ` · ${gseDown} down` : ""}`,
              href: "/equipment",
              status: "live",
              badge:
                gseDown > 0
                  ? { text: `${gseDown} down`, tone: "red" }
                  : undefined,
            },
            {
              label: "Add Equipment",
              sublabel: "Register new GSE unit",
              href: "/equipment/new",
              status: "m2",
            },
          ]}
        />
        <SectionCard
          icon="⛽"
          title="Fuel Management"
          blurb="Order fuel, manage suppliers, track pricing, and view fuel reports across all bases."
          links={[
            {
              label: "Order Fuel",
              sublabel: "New fuel order by aircraft and base",
              href: "/fuel/orders/new",
              status: "live",
            },
            {
              label: "Fuel Orders",
              sublabel: "All orders, status, and history",
              href: "/fuel/orders",
              status: "live",
            },
            {
              label: "Suppliers & Pricing",
              sublabel: "Manage fuel suppliers and base pricing",
              href: "/fuel/suppliers",
              status: "live",
            },
            {
              label: "Fuel Quality Log",
              sublabel: "Quality testing records and compliance",
              href: "/fuel/quality",
              status: "m2",
            },
          ]}
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

type LinkStatus = "live" | "m2" | "m3" | "m4";

interface SectionLink {
  label: string;
  sublabel?: string;
  href: string;
  status: LinkStatus;
  badge?: { text: string; tone: "red" | "yellow" };
}

function SectionCard({
  icon,
  title,
  blurb,
  links,
}: {
  icon: string;
  title: string;
  blurb: string;
  links: SectionLink[];
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="mb-2 text-xl">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
      <ul className="mt-3 space-y-1.5">
        {links.map((link) => (
          <li key={`${link.label}-${link.href}`}>
            <SectionLinkRow link={link} />
          </li>
        ))}
      </ul>
    </article>
  );
}

function SectionLinkRow({ link }: { link: SectionLink }) {
  const isLive = link.status === "live";

  const inner = (
    <>
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
      ) : isLive ? (
        <span className="text-xs text-muted-foreground">→</span>
      ) : (
        <span className="rounded-md border border-border bg-card/60 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Coming in {link.status.toUpperCase()}
        </span>
      )}
    </>
  );

  const baseClass =
    "flex items-center justify-between rounded-md border border-border bg-card/40 px-3 py-2.5 text-sm text-foreground";

  if (isLive) {
    return (
      <Link
        href={link.href}
        className={`${baseClass} hover:border-status-blue/60 hover:bg-status-blue/5`}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div
      title={`Coming in ${link.status.toUpperCase()}`}
      className={`${baseClass} cursor-not-allowed opacity-50`}
    >
      {inner}
    </div>
  );
}
