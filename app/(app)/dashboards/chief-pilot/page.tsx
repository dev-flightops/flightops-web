import { DashboardNav } from "@/components/dashboards/dashboard-nav";
import { AlertList } from "@/components/dashboards/alert-list";
import { StatTile } from "@/components/dashboards/stat-tile";

export default function ChiefPilotDashboardPage() {
  return (
    <div className="container py-6">
      <DashboardNav active="chief-pilot" />

      <h1 className="text-xl font-bold tracking-tight">Chief Pilot</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Crew readiness, safety, and flight operations oversight
      </p>

      {/* Row 1 — 5-col stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile value={0} label="Active Crew" tone="muted" />
        <StatTile value="0/0" label="Fully Current" sub="0% compliance" tone="muted" />
        <StatTile value={0} label="Expired" tone="muted" />
        <StatTile value={0} label="Expiring Soon" sub="next 30 days" tone="muted" />
        <StatTile value={0} label="Airborne Now" tone="muted" />
      </div>

      {/* Row 2 — 2-col: Crew alerts + Duty periods */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Crew & Ops Alerts" milestone="M3">
          <AlertList
            alerts={[]}
            emptyHint="No active alerts. Medical certificate expirations, recurrent due dates, and crew legality violations populate here once the crew-service ships in M3."
          />
        </Panel>

        <Panel title="Open Duty Periods" milestone="M3">
          <p className="py-4 text-center text-xs text-muted-foreground/70">
            0 pilots on duty. Active duty periods with FAR 117 rest progress
            bars appear here once the crew-service ships in M3.
          </p>
        </Panel>
      </div>

      {/* Row 3 — Crew Currency Matrix */}
      <Panel
        title="Crew Currency Matrix"
        milestone="M3"
        className="mt-5"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                <th className="px-2 py-2">Pilot</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">90-Day Ldgs</th>
                <th className="px-2 py-2">IPC</th>
                <th className="px-2 py-2">Recurrent</th>
                <th className="px-2 py-2">Medical</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted-foreground/70">
                  0 pilots tracked. Per-PIC currency rows populate here when
                  crew-service ships.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Row 4 — 2-col: Pilot Risk Profiles + Review */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Pilot Risk Profiles (90d)" milestone="M3">
          <p className="py-4 text-center text-xs text-muted-foreground/70">
            0 pilots scored. Per-PIC risk rolling-up dispatch risk scores
            populates here once risk-analytics ships.
          </p>
        </Panel>

        <Panel title="HIGH / EXTREME Review" milestone="M3">
          <ul className="space-y-1.5 text-xs">
            <li className="flex items-baseline justify-between border-b border-border/40 py-1">
              <span className="text-foreground/80">HIGH dispatches (30d)</span>
              <span className="font-mono font-semibold text-status-orange">0</span>
            </li>
            <li className="flex items-baseline justify-between border-b border-border/40 py-1">
              <span className="text-foreground/80">EXTREME dispatches (30d)</span>
              <span className="font-mono font-semibold text-status-red">0</span>
            </li>
            <li className="flex items-baseline justify-between py-1">
              <span className="text-foreground/80">Pending review</span>
              <span className="font-mono font-semibold text-muted-foreground">0</span>
            </li>
          </ul>
        </Panel>
      </div>

      {/* Row 5 — 2-col: Overrides + Recognition */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Recent Overrides" milestone="M3">
          <p className="py-4 text-center text-xs text-muted-foreground/70">
            0 overrides logged. Supervisor-approved currency / risk overrides
            appear here with full audit trail.
          </p>
        </Panel>

        <Panel title="Pilot Recognition" milestone="M3">
          <p className="py-4 text-center text-xs text-muted-foreground/70">
            0 highlights. On-time / completion / safety standouts surface
            here once outcomes ship.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  milestone,
  children,
  className,
}: {
  title: string;
  milestone: "M2" | "M3" | "M4";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 ${className ?? ""}`}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </h2>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-muted-foreground">
          {milestone}
        </span>
      </div>
      {children}
    </section>
  );
}
