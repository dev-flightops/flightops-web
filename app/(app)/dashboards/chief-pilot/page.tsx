import Link from "next/link";

import { PageHeader } from "@/components/ff/page-header";
import { AlertList } from "@/components/dashboards/alert-list";
import { StatTile } from "@/components/dashboards/stat-tile";
import { getComplianceBoard } from "@/lib/api/ops";
import { loadOperationalSnapshot } from "@/lib/dashboards/operational-snapshot";
import { snapshotAlertsToList } from "@/lib/dashboards/snapshot-to-alerts";

const STATUS_WORDS: Record<string, string> = {
  non_current: "Not current",
  grace_month: "Grace month",
  due_this_month: "Due this month",
  early_month: "Early month",
  upcoming: "Current",
  not_started: "Records missing",
};

export default async function ChiefPilotDashboardPage() {
  // The crew tiles read the currency board (#157: they had said "Not
  // built yet"); the snapshot gives "Airborne Now".
  const [snapshot, crew] = await Promise.all([
    loadOperationalSnapshot(),
    getComplianceBoard().catch(() => null),
  ]);

  return (
    <div className="container py-6">

      <PageHeader
        title="Chief Pilot"
        description="Crew readiness, safety, and flight operations oversight"
      />

      {/* Row 1 — 5-col stats. Sub copy matches legacy verbatim per the
          fidelity rule. */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 md:grid-cols-5">
        {/* The four crew tiles, from the currency board the Fleet
            Compliance page shows (#157). Without it they aren't shown. */}
        {crew ? (
          <>
            <StatTile value={crew.rows.length} label="Active Crew" tone="default" />
            <StatTile
              value={`${crew.chips.fully_current}/${crew.rows.length}`}
              label="Fully Current"
              sub={crew.chips.records_missing ? `${crew.chips.records_missing} with records missing` : undefined}
              tone="green"
            />
            <StatTile
              value={crew.chips.non_current}
              label="Expired"
              tone={crew.chips.non_current > 0 ? "red" : "muted"}
            />
            <StatTile
              value={crew.chips.grace_month + crew.chips.early_month}
              label="Expiring Soon"
              sub="in their early or grace month"
              tone={crew.chips.grace_month > 0 ? "yellow" : "muted"}
            />
          </>
        ) : null}
        <StatTile
          value={snapshot.airborneCount}
          label="Airborne Now"
          tone={snapshot.airborneCount > 0 ? "blue" : "muted"}
        />
      </div>

      {/* Row 2 — 2-col: Crew alerts + Duty periods */}
      <div className="mt-6 grid grid-cols-1 items-start gap-5 md:grid-cols-2">
        {/* The panel is titled "Crew & Ops Alerts" — legacy's wording,
            and legacy means it: its chief pilot dashboard renders
            alert_list(alerts) under that heading. Ours passed [] while
            the same page already had the snapshot in hand for the
            Airborne Now tile, so a chief pilot read "No active alerts"
            with an aircraft grounded or a flight overdue, and the
            executive and director-ops dashboards showed both from the
            identical source. The Ops half is now wired the way they
            are; the Crew half genuinely has nowhere to come from. */}
        <Panel title="Crew & Ops Alerts">
          <AlertList
            alerts={snapshotAlertsToList(snapshot.alerts)}
            emptyHint="No grounded aircraft, overdue flights or MELs expiring in the next two days. Medical certificate expirations, recurrent due dates and crew legality violations are not wired — no crew-service exists to supply them."
          />
        </Panel>

        <Panel
          title="Open Duty Periods"
          headerLink={{ label: "pilot roster →", href: "/compliance/roster" }}
        >
          {/* Not "0 pilots on duty" — that asserted a count with
              nothing behind it. /ops/duty/current returns the caller's
              own duty status; there is no tenant-wide endpoint for who
              is on duty, so this panel cannot know the number is zero. */}
          <p className="py-4 text-center text-xs text-muted-foreground">
            Tenant-wide duty periods with FAR 117 rest progress are not
            built — /ops/duty/current reports only your own status.
          </p>
        </Panel>
      </div>

      {/* Row 3 — Crew Currency Matrix, from the currency board (#157: it
          had said "Not wired here yet"). Legacy's role and base columns
          aren't on the board, so the matrix shows what is. */}
      <Panel
        title="Crew Currency Matrix"
        className="mt-5"
        headerLink={{
          label: "fleet compliance →",
          href: "/compliance/crew-currency",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="ff-thead">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Medical Exp.</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Issues</th>
              </tr>
            </thead>
            <tbody>
              {crew === null ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    The currency board didn&apos;t load; it&apos;s on Fleet Compliance.
                  </td>
                </tr>
              ) : (
                crew.rows.map((row) => {
                  const medicalId = crew.items.find((i) => i.code === "medical_certificate")?.id;
                  const medical = row.cells.find((c) => c.currency_item_id === medicalId);
                  const issues = row.cells
                    .filter((c) => ["non_current", "grace_month", "not_started"].includes(c.status))
                    .map((c) => crew.items.find((i) => i.id === c.currency_item_id)?.name ?? "")
                    .filter(Boolean);
                  return (
                    <tr key={row.pilot.id} className="border-t border-border">
                      <td className="px-2 py-1.5 font-semibold">{row.pilot.full_name}</td>
                      <td className="px-2 py-1.5 font-mono">{medical?.base_month_due ?? "—"}</td>
                      <td className="px-2 py-1.5">{STATUS_WORDS[row.overall_status] ?? row.overall_status}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {issues.length ? issues.join(", ") : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

    </div>
  );
}

function Panel({
  title,
  headerLink,
  children,
  className,
}: {
  title: string;
  /** Optional trailing link in the heading row (matches legacy's
   *  "crew records →" / "full analytics →" / "all →" affordances). */
  headerLink?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-border bg-card p-5 ${className ?? ""}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="panel-title">
          {title}
        </h2>
        <div className="flex items-baseline gap-2">
          {headerLink && (
            <Link
              href={headerLink.href}
              className="text-[0.7rem] text-muted-foreground hover:text-primary"
            >
              {headerLink.label}
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
