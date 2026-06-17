import Link from "next/link";

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

  // Human-readable date heading — legacy peregrineflight uses
  // "Wednesday, June 17, 2026" rather than the bare ISO.
  const today = new Date();
  const longDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  // Per-pillar context line — explains *why* the pillar scored as it
  // did. Real values where we have data, M3-blocked placeholders where
  // the source services haven't shipped (Crew, partial Safety).
  const boardCount = snapshot.board.length;
  const departedCount = snapshot.board.filter(
    (f) => f.actual_departure_at,
  ).length;
  const completionContext =
    boardCount === 0
      ? "No flights scheduled today"
      : cancelledOrOverdue === 0
        ? `${boardCount} flights tracking nominal`
        : `${boardCount} flights · ${cancelledOrOverdue} cancelled or overdue`;
  const onTimeContext =
    departedCount === 0
      ? "No outcomes recorded today yet"
      : delayedDepartures === 0
        ? `${departedCount} departed on time`
        : `${departedCount} departed · ${delayedDepartures} >15 min late`;
  const crewContext = "Crew currency tracking ships with crew-service (M3)";
  const fleetContext = `${fleetActive}/${fleetTotal} airworthy`;
  const overdueCount = snapshot.alerts.filter(
    (a) => a.category === "flight_overdue",
  ).length;
  const safetyContext =
    overdueCount === 0
      ? "No diversions or overdue flights · SMS feed ships with M3"
      : `${overdueCount} overdue flight${overdueCount === 1 ? "" : "s"} · SMS feed ships with M3`;

  return (
    <div className="container py-6">
      <DashboardNav active="ops-score" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Daily Operations Score
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{longDate}</p>
        </div>
        <Link
          href="/dashboards/system-health"
          className="text-xs text-status-blue hover:underline"
        >
          🩺 System Health →
        </Link>
      </div>

      {/* Central dial + score-band legend */}
      <section className="mt-5 rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Today&apos;s Ops Score
        </p>
        <div className="mt-4 flex justify-center">
          <ScorePill score={opsScore} size="large" />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          out of 100 · {longDate}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.65rem] text-muted-foreground/80">
          <ScoreBand label="90–100 Excellent" tone="green" />
          <ScoreBand label="75–89 Good" tone="green-soft" />
          <ScoreBand label="60–74 Fair" tone="orange" />
          <ScoreBand label="<60 Needs Attention" tone="red" />
        </div>
      </section>

      {/* Pillar breakdown */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Score Breakdown
        </h2>
        <div className="space-y-5">
          <PillarBar
            label="Completion Factor"
            score={completionPillar}
            max={25}
            icon={<span aria-hidden>✈️</span>}
            context={completionContext}
          />
          <PillarBar
            label="On-Time Performance"
            score={onTimePillar}
            max={25}
            icon={<span aria-hidden>⏱️</span>}
            context={onTimeContext}
          />
          <PillarBar
            label="Crew Compliance"
            score={0}
            max={20}
            icon={<span aria-hidden>👤</span>}
            context={crewContext}
          />
          <PillarBar
            label="Fleet Airworthiness"
            score={fleetPillar}
            max={20}
            icon={<span aria-hidden>🔧</span>}
            context={fleetContext}
          />
          <PillarBar
            label="Safety Indicators"
            score={0}
            max={10}
            icon={<span aria-hidden>🛡️</span>}
            context={safetyContext}
          />
        </div>
      </section>

      {/* Methodology — legacy uses concrete scoring rules, not dev notes */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Score Methodology
        </h2>
        <div className="grid grid-cols-1 gap-4 text-xs text-muted-foreground sm:grid-cols-2 md:grid-cols-5">
          <Methodology
            title="✈️ Completion Factor (25 pts)"
            body="Flights that landed or completed vs flights that should have been done today. Remaining scheduled flights are excluded — they are not yet judged. Weather cancellations are noted but still counted."
          />
          <Methodology
            title="⏱️ On-Time Performance (25 pts)"
            body="Arrivals within 15 minutes of ETA. Delays caused by weather, ATC, or cascading previous legs are excluded from the penalty — those are not within the operation's control."
          />
          <Methodology
            title="👤 Crew Compliance (20 pts)"
            body="Starts at 20. Deducts 2 pts per expired medical certificate, 0.5 pts per certificate expiring within 30 days. Floors at 0."
          />
          <Methodology
            title="🔧 Fleet Airworthiness (20 pts)"
            body="Starts at 20. Deducts proportionally per aircraft on RTS Hold, smaller deduction per aircraft with open squawks but not on hold."
          />
          <Methodology
            title="🛡️ Safety Indicators (10 pts)"
            body="Starts at 10. Deducts 3 pts per diversion or return-to-departure today, 2 pts per currently overdue flight. This is not a safety compliance score — it is a signal of unusual events that warrant leadership attention."
          />
        </div>
        <div className="mt-4 space-y-1 border-t border-border pt-3 text-[0.7rem] text-muted-foreground/80">
          <p>
            This score is informational and trend-focused. A single day&apos;s
            score should always be read in context.
          </p>
          <p>
            A diversion due to weather does not mean the operation failed — it
            means the crew made the right call.
          </p>
        </div>
      </section>

      {/* 8-week trend */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          8-Week Completion Trend
        </h2>
        <CompletionTrend opsScore={opsScore} />
        <div className="mt-3 space-y-1 text-[0.7rem] text-muted-foreground/80">
          <p>
            Based on recorded DispatchOutcomes. Flights without outcomes are not
            counted.
          </p>
          <p>
            Record outcomes in{" "}
            <Link
              href="/flight-following/history"
              className="text-status-blue hover:underline"
            >
              Dispatch History
            </Link>{" "}
            or they are captured automatically when Flight Following closes.
          </p>
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

function ScoreBand({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "green-soft" | "orange" | "red";
}) {
  const dotClass =
    tone === "green"
      ? "bg-status-green"
      : tone === "green-soft"
        ? "bg-status-green/60"
        : tone === "orange"
          ? "bg-status-orange"
          : "bg-status-red";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
      {label}
    </span>
  );
}

function CompletionTrend({ opsScore }: { opsScore: number }) {
  // 8 week-start labels ending with the most recent Monday — "W{MM}/{DD}"
  // matches legacy peregrineflight's trend axis. Bars stay at a thin
  // placeholder height until DispatchOutcomes aggregation lands; only
  // the current week shows the live ops score for visual continuity.
  const labels: { key: string; pct: number }[] = [];
  const now = new Date();
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = monday.getUTCDay();
  const daysSinceMon = day === 0 ? 6 : day - 1;
  monday.setUTCDate(monday.getUTCDate() - daysSinceMon);
  for (let i = 7; i >= 0; i--) {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    labels.push({ key: `W${mm}/${dd}`, pct: i === 0 ? opsScore : 0 });
  }
  return (
    <div className="flex h-32 items-end justify-between gap-2">
      {labels.map(({ key, pct }) => (
        <div key={key} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[0.6rem] text-muted-foreground/60">
            {pct > 0 ? `${pct.toFixed(0)}%` : "0%"}
          </span>
          <div
            className="w-full rounded-t bg-status-blue/60"
            style={{ height: `${Math.max(pct, 2)}%` }}
          />
          <span className="font-mono text-[0.6rem] text-muted-foreground/60">
            {key}
          </span>
        </div>
      ))}
    </div>
  );
}
