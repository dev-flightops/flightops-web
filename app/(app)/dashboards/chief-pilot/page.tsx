import Link from "next/link";

import { DashboardNav } from "@/components/dashboards/dashboard-nav";
import { AlertList } from "@/components/dashboards/alert-list";
import { StatTile } from "@/components/dashboards/stat-tile";
import { loadOperationalSnapshot } from "@/lib/dashboards/operational-snapshot";

export default async function ChiefPilotDashboardPage() {
  // Almost everything on this page is crew-service data (M3); we only
  // pull the snapshot for the "Airborne Now" tile so it doesn't read
  // hardcoded 0 like the rest of the M3-blocked metrics.
  const snapshot = await loadOperationalSnapshot();

  return (
    <div className="container py-6">
      <DashboardNav active="chief-pilot" />

      <h1 className="text-xl font-bold tracking-tight">Chief Pilot</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Crew readiness, safety, and flight operations oversight
      </p>

      {/* Row 1 — 5-col stats. Sub copy matches legacy verbatim per the
          fidelity rule. */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <StatTile value={0} label="Active Crew" tone="muted" />
        <StatTile value="0/0" label="Fully Current" sub="0%" tone="muted" />
        <StatTile
          value={0}
          label="Expired"
          sub="immediate action"
          tone="muted"
        />
        <StatTile
          value={0}
          label="Expiring Soon"
          sub="< 30 days"
          tone="muted"
        />
        <StatTile
          value={snapshot.airborneCount}
          label="Airborne Now"
          tone={snapshot.airborneCount > 0 ? "blue" : "muted"}
        />
      </div>

      {/* Row 2 — 2-col: Crew alerts + Duty periods */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Panel title="Crew & Ops Alerts" milestone="M3">
          <AlertList
            alerts={[]}
            emptyHint="No active alerts. Medical certificate expirations, recurrent due dates, and crew legality violations populate here once the crew-service ships in M3."
          />
        </Panel>

        <Panel
          title="Open Duty Periods"
          milestone="M3"
          headerLink={{ label: "crew records →", href: "/crew" }}
        >
          <p className="py-4 text-center text-xs text-muted-foreground/70">
            0 pilots on duty. Active duty periods with FAR 117 rest progress
            bars appear here once the crew-service ships in M3.
          </p>
        </Panel>
      </div>

      {/* Row 3 — Crew Currency Matrix.
          Columns mirror legacy verbatim: NAME / ROLE / BASE / MEDICAL EXP /
          STATUS / ISSUES. Rows populate from crew-service in M3. */}
      <Panel title="Crew Currency Matrix" milestone="M3" className="mt-5">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Role</th>
                <th className="px-2 py-2">Base</th>
                <th className="px-2 py-2">Medical Exp.</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Issues</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={6}
                  className="py-6 text-center text-muted-foreground/70"
                >
                  0 pilots tracked. Per-PIC currency rows populate here when
                  crew-service ships.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Row 4 — 2-col: Pilot Risk Profiles + Review.
          Both are single-line empty states until the underlying services
          ship (risk-analytics for risk, dispatch-outcomes for the review). */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Panel
          title="Pilot Risk Profiles (90d)"
          milestone="M3"
        >
          <p className="py-4 text-center text-xs text-muted-foreground/70">
            No pilot data in the last 90 days.
          </p>
        </Panel>

        <Panel title="HIGH / EXTREME Review (90d)" milestone="M3">
          <p className="py-4 text-center text-xs text-muted-foreground/70">
            No HIGH/EXTREME dispatches in the last 90 days.
          </p>
        </Panel>
      </div>

      {/* Row 5 — 2-col: Overrides + Recognition */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Panel title="Recent Overrides" milestone="M3">
          <p className="py-4 text-center text-xs text-muted-foreground/70">
            No overrides in the last 90 days.
          </p>
        </Panel>

        <Panel
          title="Pilot Recognition"
          milestone="M3"
          headerLink={{ label: "all →", href: "/recognition/pilots" }}
        >
          <p className="py-4 text-center text-xs text-muted-foreground/70">
            No achievements yet.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  milestone,
  headerLink,
  children,
  className,
}: {
  title: string;
  milestone: "M2" | "M3" | "M4";
  /** Optional trailing link in the heading row (matches legacy's
   *  "crew records →" / "full analytics →" / "all →" affordances). */
  headerLink?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-border bg-card p-5 ${className ?? ""}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <div className="flex items-baseline gap-2">
          {headerLink && (
            <Link
              href={headerLink.href}
              className="text-[0.7rem] text-muted-foreground/70 hover:text-status-blue"
            >
              {headerLink.label}
            </Link>
          )}
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-muted-foreground">
            {milestone}
          </span>
        </div>
      </div>
      {children}
    </section>
  );
}
