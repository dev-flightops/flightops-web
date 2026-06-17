import { Activity, Clock, Plane, ShieldCheck, Users } from "lucide-react";

import { DashboardNav } from "@/components/dashboards/dashboard-nav";
import { PillarBar } from "@/components/dashboards/pillar-bar";
import { ScorePill } from "@/components/dashboards/score-pill";
import { getFlightStats } from "@/lib/api/ops";
import { loadOperationalSnapshot } from "@/lib/dashboards/operational-snapshot";

export default async function OpsScoreDashboardPage() {
  const [stats, snapshot] = await Promise.all([
    getFlightStats().catch(() => null),
    loadOperationalSnapshot(),
  ]);
  // Pillar model matches the executive dashboard exactly: default-full-
  // credit for Completion + On-Time, subtract per failure; fleet pillar
  // scales linearly with airworthy count; Crew + Safety stay 0 until
  // their M3 services ship.
  const fleetTotal =
    snapshot.fleetTotal > 0 ? snapshot.fleetTotal : stats?.aircraft_total ?? 0;
  const fleetActive =
    snapshot.fleetTotal > 0
      ? snapshot.fleetAirworthy
      : stats?.aircraft_active ?? 0;
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

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="container py-6">
      <DashboardNav active="ops-score" />

      <h1 className="text-xl font-bold tracking-tight">Daily Operations Score</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">
        <span className="font-mono">{today}</span> (UTC) · one number for today&apos;s ops health
      </p>

      {/* Central dial */}
      <section className="mt-5 rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Today&apos;s Ops Score
        </p>
        <div className="mt-4 flex justify-center">
          <ScorePill score={opsScore} size="large" />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          out of 100 possible points — computed across the five pillars below
        </p>
      </section>

      {/* Pillar breakdown */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Pillar Breakdown
        </h2>
        <div className="space-y-4">
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

      {/* Methodology */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Methodology
        </h2>
        <div className="grid grid-cols-1 gap-4 text-xs text-muted-foreground sm:grid-cols-2 md:grid-cols-5">
          <Methodology
            title="Completion Factor (25 pts)"
            body="Released flights that completed without cancellation or diversion. Computed from outcomes once flight-following adds ATD/ATA timestamps (M2)."
          />
          <Methodology
            title="On-Time Performance (25 pts)"
            body="ATD within 15 minutes of STD across all completed flights. Same dependency: flight-following ATD/ATA (M2)."
          />
          <Methodology
            title="Crew Compliance (20 pts)"
            body="Share of dispatched flights where the PIC was fully current at release time. Needs crew-service (M3)."
          />
          <Methodology
            title="Fleet Airworthiness (20 pts)"
            body="Share of active aircraft today with no open MEL blockers. The only pillar partially computable in M1 — uses aircraft.is_active as a proxy until maintenance-service ships."
          />
          <Methodology
            title="Safety Indicators (10 pts)"
            body="No HIGH/EXTREME risk releases without supervisor override + no SMS incidents in the last 24h. Needs risk-analytics + safety-service (M3)."
          />
        </div>
      </section>

      {/* 8-week trend */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            8-Week Score Trend
          </h2>
          <span className="text-[0.65rem] text-muted-foreground/70">
            flight-following · M2
          </span>
        </div>
        <div className="flex h-32 items-end justify-between gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-muted"
                style={{ height: i === 7 ? `${opsScore}%` : "0%" }}
              />
              <span className="font-mono text-[0.6rem] text-muted-foreground/60">
                w-{8 - i}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Methodology({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="mb-1 font-semibold text-foreground">{title}</p>
      <p>{body}</p>
    </div>
  );
}
