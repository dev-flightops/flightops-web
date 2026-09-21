import Link from "next/link";

import { DashboardNav } from "@/components/dashboards/dashboard-nav";
import { AlertList } from "@/components/dashboards/alert-list";
import { StatTile } from "@/components/dashboards/stat-tile";
import { loadOperationalSnapshot } from "@/lib/dashboards/operational-snapshot";
import { snapshotAlertsToList } from "@/lib/dashboards/snapshot-to-alerts";

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
        {/* The panel is titled "Crew & Ops Alerts" — legacy's wording,
            and legacy means it: its chief pilot dashboard renders
            alert_list(alerts) under that heading. Ours passed [] while
            the same page already had the snapshot in hand for the
            Airborne Now tile, so a chief pilot read "No active alerts"
            with an aircraft grounded or a flight overdue, and the
            executive and director-ops dashboards showed both from the
            identical source. The Ops half is now wired the way they
            are; the Crew half genuinely has nowhere to come from. */}
        <Panel title="Crew & Ops Alerts" milestone="M3">
          <AlertList
            alerts={snapshotAlertsToList(snapshot.alerts)}
            emptyHint="No grounded aircraft, overdue flights or MELs expiring in the next two days. Medical certificate expirations, recurrent due dates and crew legality violations are not wired — no crew-service exists to supply them."
          />
        </Panel>

        <Panel
          title="Open Duty Periods"
          milestone="M3"
          headerLink={{ label: "pilot roster →", href: "/compliance/roster" }}
        >
          {/* Not "0 pilots on duty" — that asserted a count with
              nothing behind it. /ops/duty/current returns the caller's
              own duty status; there is no tenant-wide endpoint for who
              is on duty, so this panel cannot know the number is zero. */}
          <p className="py-4 text-center text-xs text-muted-foreground/70">
            Tenant-wide duty periods with FAR 117 rest progress are not
            built — /ops/duty/current reports only your own status.
          </p>
        </Panel>
      </div>

      {/* Row 3 — Crew Currency Matrix.
          Columns mirror legacy verbatim: NAME / ROLE / BASE / MEDICAL EXP /
          STATUS / ISSUES. The rows are not wired, but the data is not
          missing: /compliance/crew-currency has been live since M3 and
          shows per-pilot medical and currency status. The panel used to
          say the rows arrive "when crew-service ships", which sent a
          chief pilot away from a page that already had the answer, so
          it now links there. */}
      <Panel
        title="Crew Currency Matrix"
        milestone="M3"
        className="mt-5"
        headerLink={{
          label: "fleet compliance →",
          href: "/compliance/crew-currency",
        }}
      >
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
                  Not wired here yet — per-pilot medical and currency
                  status is on Fleet Compliance.
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
