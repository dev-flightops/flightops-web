import { Activity, Clock, Plane, ShieldCheck, Users } from "lucide-react";

import { AlertList } from "@/components/dashboards/alert-list";
import { FleetAirworthinessPanel } from "@/components/dashboards/fleet-airworthiness-panel";
import { LiveOpsBoard } from "@/components/dashboards/live-ops-board";
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

  // Pillar scoring — Fleet/Completion/On-Time are derivable from M1+M2
  // data; Crew Compliance + Safety Indicators need M3 services and stay
  // at 0 until then.
  //
  // The model is "default-full-credit, subtract for visible failures" —
  // matches the legacy peregrineflight behavior. Early in the day with
  // no cancellations or delays, the score is high; each failure event
  // docks points until floored at 0.
  const fleetPillar =
    fleetTotal > 0 ? Math.round((fleetActive / fleetTotal) * 200) / 10 : 0;

  const cancelledOrOverdue = snapshot.board.filter(
    (f) => f.status === "cancelled" || f.is_overdue,
  ).length;
  const completionPillar = Math.max(0, 25 - cancelledOrOverdue * 5);

  const FIFTEEN_MIN_MS = 15 * 60 * 1000;
  const delayedDepartures = snapshot.board.filter((f) => {
    if (!f.actual_departure_at) return false;
    const delta =
      new Date(f.actual_departure_at).getTime() -
      new Date(f.scheduled_departure_at).getTime();
    return delta > FIFTEEN_MIN_MS;
  }).length;
  const onTimePillar = Math.max(0, 25 - delayedDepartures * 5);

  const opsScore =
    Math.round((completionPillar + onTimePillar + fleetPillar) * 10) / 10;

  // Executive Analytics sub: passengers on today's board + actual flown
  // hours for any completed leg today. Matches legacy's "N pax · X.X hrs"
  // format. Values stay 0 until check-in flow stamps actual_arrival_at.
  const todayPax = snapshot.board.reduce((s, f) => s + (f.pax_count ?? 0), 0);
  const todayHours = snapshot.board.reduce((s, f) => {
    if (!f.actual_departure_at || !f.actual_arrival_at) return s;
    const ms =
      new Date(f.actual_arrival_at).getTime() -
      new Date(f.actual_departure_at).getTime();
    return s + Math.max(0, ms / (1000 * 60 * 60));
  }, 0);

  const currentTenantName =
    tenantsResponse.tenants.find((t) => t.is_current)?.name ??
    tenantsResponse.tenants[0]?.name ??
    "Peregrine Flight Ops";

  return (
    <div className="container py-6">

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executive Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentTenantName} — {currentTenantName}
          </p>
        </div>
        <ScorePill score={opsScore} />
      </div>

      {/* Row 1 — 5-col headline stat tiles.
          Tones match legacy peregrineflight: brand colors are stable
          per-metric, not status-driven. Aircraft Airborne stays blue
          even at 0; Flights Today + Fleet Airworthy stay green; the
          M3/M4-blocked tiles (Crew, Overrides) stay muted. */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <StatTile
          value={snapshot.airborneCount}
          label="Aircraft Airborne"
          tone="blue"
        />
        <StatTile
          value={todayCount}
          label="Flights Today"
          sub={`${completedPct.toFixed(1)}% complete`}
          tone="green"
        />
        <StatTile
          value={fleetTotal > 0 ? `${fleetActive}/${fleetTotal}` : "0/0"}
          label="Fleet Airworthy"
          sub={`${fleetGrounded} on hold`}
          tone="green"
        />
        {/* Not wired. These printed "0/0" and "0" as if measured; a dash
            and "Not built yet" is what is true. */}
        <StatTile value="—" label="Crew Current" sub="Not built yet" tone="muted" />
        <StatTile value="—" label="Overrides (30d)" sub="Not built yet" tone="muted" />
      </div>

      {/* Row 2 — 6-col financial row. Smaller value font (size="small")
          and each tile takes a stable brand color per legacy: green
          revenue/margin, blue rev-per-hour, yellow forecast, purple AR,
          and the analytics → arrow stays neutral. */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {/* The five money tiles were literal "$0" and "0%" — an executive
            reading them would take the operation for broke. They are not
            wired; the Executive Summary report computes these figures. */}
        <StatTile value="—" label="Revenue MTD" sub="Not built yet" tone="muted" size="small" />
        <StatTile value="—" label="Profit Margin" sub="Not built yet" tone="muted" size="small" />
        <StatTile value="—" label="Rev / FH" sub="Not built yet" tone="muted" size="small" />
        <StatTile value="—" label="30d Forecast" sub="Not built yet" tone="muted" size="small" />
        <StatTile value="—" label="Outstanding AR" sub="Not built yet" tone="muted" size="small" />
        <StatTile
          value="→"
          label="Executive Analytics"
          sub={`${todayPax} pax · ${todayHours.toFixed(1)} hrs`}
          tone="default"
          size="small"
        />
      </div>

      {/* Row 3 — 2-col: alerts + ops-score pillars */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Alerts
            </h2>
            <span className="text-[0.65rem] text-muted-foreground">
              {snapshot.alerts.length} live · 6 more alert types land with their services
            </span>
          </div>
          <AlertList
            alerts={snapshotAlertsToList(snapshot.alerts)}
            emptyHint="No grounded aircraft, overdue flights or MELs expiring in the next two days. Pilot currency, NOTAM and safety alerts are not fed into this list — safety-service ships hazards but nothing routes them here."
          />
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Daily Operations Score —{" "}
              <span className="text-foreground">{opsScore.toFixed(1)}/100</span>
            </h2>
            <span className="text-[0.65rem] text-muted-foreground">
              details →
            </span>
          </div>
          <div className="space-y-3">
            <PillarBar
              label="Completion Factor"
              score={completionPillar}
              max={25}
              icon={<Plane className="h-3.5 w-3.5 text-muted-foreground" />}
            />
            <PillarBar
              label="On-Time Performance"
              score={onTimePillar}
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

      {/* Row 4 — 2-col: fleet airworthiness list + live ops board */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <FleetAirworthinessPanel fleet={snapshot.fleet} />
        <LiveOpsBoard board={snapshot.board} />
      </div>
    </div>
  );
}
