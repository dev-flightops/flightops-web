import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { PageHeader } from "@/components/ff/page-header";
import { AlertList } from "@/components/dashboards/alert-list";
import { FleetAirworthinessPanel } from "@/components/dashboards/fleet-airworthiness-panel";
import { LiveOpsBoard } from "@/components/dashboards/live-ops-board";
import { PillarBar } from "@/components/dashboards/pillar-bar";
import { ScorePill } from "@/components/dashboards/score-pill";
import { StatTile } from "@/components/dashboards/stat-tile";
import { listMyTenants } from "@/lib/api/auth";
import { listCustomerInvoices } from "@/lib/api/customer-invoices";
import { getComplianceBoard, getFlightStats } from "@/lib/api/ops";
import { loadOperationalSnapshot } from "@/lib/dashboards/operational-snapshot";
import { snapshotAlertsToList } from "@/lib/dashboards/snapshot-to-alerts";

export default async function ExecutiveDashboardPage() {
  const [stats, tenantsResponse, snapshot, crew, invoices] = await Promise.all([
    getFlightStats().catch(() => null),
    listMyTenants().catch(() => ({ tenants: [] })),
    loadOperationalSnapshot(),
    // #157: the client's "7 tiles 'Not built yet'". Crew and receivables
    // come from the currency board and billing; the rest are hidden.
    getComplianceBoard().catch(() => null),
    listCustomerInvoices({ limit: 1 }).catch(() => null),
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

      {/* The operator's name once, above the title; the line under the
          title printed it twice ("Name — Name"). */}
      <PageHeader
        eyebrow={currentTenantName}
        title="Executive Overview"
        actions={<ScorePill score={opsScore} />}
      />

      {/* Row 1 — 5-col headline stat tiles.
          Tones match legacy peregrineflight: brand colors are stable
          per-metric, not status-driven. Aircraft Airborne stays blue
          even at 0; Flights Today + Fleet Airworthy stay green; the
          M3/M4-blocked tiles (Crew, Overrides) stay muted. */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 md:grid-cols-4">
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
        {/* From the currency board (#157). A tile with nothing behind it
            (overrides) isn't shown. */}
        {crew ? (
          <StatTile
            value={`${crew.chips.fully_current}/${crew.rows.length}`}
            label="Crew Current"
            sub={
              crew.chips.records_missing
                ? `${crew.chips.records_missing} with records missing`
                : `${crew.chips.non_current} not current`
            }
            tone={crew.chips.non_current > 0 ? "red" : "green"}
          />
        ) : null}
      </div>

      {/* Row 2 — 6-col financial row. Smaller value font (size="small")
          and each tile takes a stable brand color per legacy: green
          revenue/margin, blue rev-per-hour, yellow forecast, purple AR,
          and the analytics → arrow stays neutral. */}
      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border pt-5 sm:grid-cols-3 md:grid-cols-5">
        {/* The money tiles were literal "$0" and "0%", then "Not built yet"
            (#157). Receivables come from billing; revenue, margin, rev/FH
            and the forecast are the Executive Summary report's, so they
            aren't repeated here. */}
        {invoices ? (
          <StatTile
            value={`$${Math.round(invoices.outstanding_cents / 100).toLocaleString("en-US")}`}
            label="Outstanding AR"
            sub="sent invoices less payments"
            tone="default"
            size="small"
          />
        ) : null}
        <StatTile
          value="→"
          label="Executive Analytics"
          sub={`${todayPax} pax · ${todayHours.toFixed(1)} hrs`}
          tone="default"
          size="small"
        />
      </div>

      {/* Row 3 — 2-col: alerts + ops-score pillars */}
      <div className="mt-6 grid grid-cols-1 items-start gap-5 md:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-border bg-card p-5">
          <div className="-mx-5 -mt-5 mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
            <h2 className="panel-title">
              Active Alerts
            </h2>
            <span className="text-[0.65rem] text-muted-foreground">
              {snapshot.alerts.length} live
            </span>
          </div>
          <AlertList
            alerts={snapshotAlertsToList(snapshot.alerts)}
            emptyHint="No grounded aircraft, overdue flights or MELs expiring in the next two days."
          />
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-card p-5">
          <div className="-mx-5 -mt-5 mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
            <h2 className="panel-title">
              Daily Operations Score —{" "}
              <span className="text-foreground">{opsScore.toFixed(1)}/100</span>
            </h2>
            <Link href="/dashboards/ops-score" className={linkCaps}>
              Details <span aria-hidden>›</span>
            </Link>
          </div>
          <div className="space-y-3">
            <PillarBar
              label="Completion Factor"
              score={completionPillar}
              max={25}
            />
            <PillarBar
              label="On-Time Performance"
              score={onTimePillar}
              max={25}
            />
            <PillarBar
              label="Crew Compliance"
              score={0}
              max={20}
            />
            <PillarBar
              label="Fleet Airworthiness"
              score={fleetPillar}
              max={20}
            />
            <PillarBar
              label="Safety Indicators"
              score={0}
              max={10}
            />
          </div>
        </section>
      </div>

      {/* Row 4 — 2-col: fleet airworthiness list + live ops board */}
      <div className="mt-6 grid grid-cols-1 items-start gap-5 md:grid-cols-2">
        <FleetAirworthinessPanel fleet={snapshot.fleet} />
        <LiveOpsBoard board={snapshot.board} />
      </div>
    </div>
  );
}
