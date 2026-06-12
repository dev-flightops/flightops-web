import { Activity, Clock, Plane, ShieldCheck, Users } from "lucide-react";

import { AlertList } from "@/components/dashboards/alert-list";
import { DashboardNav } from "@/components/dashboards/dashboard-nav";
import { PillarBar } from "@/components/dashboards/pillar-bar";
import { ScorePill } from "@/components/dashboards/score-pill";
import { StatTile } from "@/components/dashboards/stat-tile";
import { listMyTenants } from "@/lib/api/auth";
import { getFlightStats } from "@/lib/api/ops";
import { loadOperationalSnapshot } from "@/lib/dashboards/operational-snapshot";
import { snapshotAlertsToList } from "@/lib/dashboards/snapshot-to-alerts";

export default async function ExecutiveDashboardPage() {
  const [stats, tenantsResponse, snapshot] = await Promise.all([
    getFlightStats().catch(() => null),
    listMyTenants().catch(() => ({ tenants: [] })),
    loadOperationalSnapshot(),
  ]);

  const todayCount = stats?.today.total ?? 0;
  const todayReleased = stats?.today.released ?? 0;
  const completedPct =
    todayCount > 0 ? Math.round((todayReleased / todayCount) * 1000) / 10 : 0;
  // Prefer the real airworthiness rollup from maintenance-service when
  // it's available — that's `is_active && is_airworthy` per aircraft.
  // Fall back to ops `aircraft_active` (just `is_active`) if maintenance
  // is unreachable so the tile never blanks.
  const fleetTotal =
    snapshot.fleetTotal > 0 ? snapshot.fleetTotal : stats?.aircraft_total ?? 0;
  const fleetActive =
    snapshot.fleetTotal > 0
      ? snapshot.fleetAirworthy
      : stats?.aircraft_active ?? 0;
  const fleetGrounded =
    snapshot.fleetTotal > 0
      ? snapshot.fleetGrounded
      : Math.max(0, fleetTotal - fleetActive);

  // Pillar scoring — only Fleet Airworthiness is computable from M1 data.
  // The other pillars stay at 0 because their underlying services (flight-
  // following for completion/on-time, crew for compliance, safety for
  // incidents) ship in M2-M3.
  const fleetPillar =
    fleetTotal > 0 ? Math.round((fleetActive / fleetTotal) * 200) / 10 : 0;
  const opsScore = fleetPillar; // 0 + 0 + 0 + fleetPillar + 0

  const currentTenantName =
    tenantsResponse.tenants.find((t) => t.is_current)?.name ??
    tenantsResponse.tenants[0]?.name ??
    "Peregrine Flight Ops";

  return (
    <div className="container py-6">
      <DashboardNav active="executive" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Executive Overview</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {currentTenantName} — {currentTenantName}
          </p>
        </div>
        <ScorePill score={opsScore} />
      </div>

      {/* Row 1 — 5-col headline stat tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          value={snapshot.airborneCount}
          label="Aircraft Airborne"
          sub={`${snapshot.releasedCount} released today`}
          tone={snapshot.airborneCount > 0 ? "green" : "muted"}
        />
        <StatTile
          value={todayCount}
          label="Flights Today"
          sub={`${completedPct.toFixed(1)}% complete`}
          tone={todayCount > 0 ? "green" : "muted"}
        />
        <StatTile
          value={fleetTotal > 0 ? `${fleetActive}/${fleetTotal}` : "0/0"}
          label="Fleet Airworthy"
          sub={`${fleetGrounded} on hold`}
          tone={fleetActive > 0 ? "green" : "muted"}
        />
        <StatTile
          value="0/0"
          label="Crew Current"
          sub="0 expired · 0 expiring"
          tone="muted"
        />
        <StatTile
          value={0}
          label="Overrides (30d)"
          sub="0% of dispatches"
          tone="muted"
        />
      </div>

      {/* Row 2 — 6-col financial row */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile value="$0" label="Revenue MTD" sub="+0%" tone="muted" />
        <StatTile value="0%" label="Profit Margin" tone="muted" />
        <StatTile value="$0" label="Rev / FH" tone="muted" />
        <StatTile value="$0" label="30d Forecast" tone="muted" />
        <StatTile value="$0" label="Outstanding AR" tone="muted" />
        <StatTile
          value="→"
          label="Executive Analytics"
          sub="0 pax · 0 FH"
          tone="muted"
        />
      </div>

      {/* Row 3 — 2-col: alerts + ops-score pillars */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Active Alerts
            </h2>
            <span className="text-[0.65rem] text-muted-foreground/70">
              {snapshot.alerts.length} live · 7 more land with M3 services
            </span>
          </div>
          <AlertList
            alerts={snapshotAlertsToList(snapshot.alerts)}
            emptyHint="No active alerts from the wired sources. Pilot currency / NOTAM / safety report alerts populate here once their services ship in M3."
          />
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Daily Operations Score —{" "}
              <span className="text-foreground">{opsScore.toFixed(1)}/100</span>
            </h2>
            <span className="text-[0.65rem] text-muted-foreground/70">
              details →
            </span>
          </div>
          <div className="space-y-3">
            <PillarBar
              label="Completion Factor"
              score={0}
              max={25}
              icon={<Plane className="h-3.5 w-3.5 text-muted-foreground" />}
            />
            <PillarBar
              label="On-Time Performance"
              score={0}
              max={25}
              icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
            />
            <PillarBar
              label="Crew Compliance"
              score={0}
              max={20}
              icon={<Users className="h-3.5 w-3.5 text-muted-foreground" />}
            />
            <PillarBar
              label="Fleet Airworthiness"
              score={fleetPillar}
              max={20}
              icon={<Activity className="h-3.5 w-3.5 text-muted-foreground" />}
            />
            <PillarBar
              label="Safety Indicators"
              score={0}
              max={10}
              icon={<ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
