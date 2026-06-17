import Link from "next/link";

import { AlertList } from "@/components/dashboards/alert-list";
import { DashboardNav } from "@/components/dashboards/dashboard-nav";
import { ScorePill } from "@/components/dashboards/score-pill";
import { StatTile } from "@/components/dashboards/stat-tile";
import { listFlights, getFlightStats } from "@/lib/api/ops";
import { loadOperationalSnapshot } from "@/lib/dashboards/operational-snapshot";
import { snapshotAlertsToList } from "@/lib/dashboards/snapshot-to-alerts";
import type { FlightListItem } from "@/lib/api/types";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function DirectorOpsDashboardPage() {
  const today = todayUtc();
  const [stats, todaysFlights, pendingResult, snapshot] = await Promise.all([
    getFlightStats().catch(() => null),
    listFlights({ onDate: today }).catch(() => ({ items: [], total: 0 })),
    // Pull a wider window then filter to today + tomorrow client-side —
    // the API doesn't have a date-range param yet, and a bare
    // status='scheduled' query also picks up orphaned old-date rows
    // from prior seed runs. Mirrors legacy's "today + tomorrow" scope.
    listFlights({ status: "scheduled", limit: 50 }).catch(() => ({ items: [], total: 0 })),
    loadOperationalSnapshot(),
  ]);

  const todayDate = today;
  const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const pendingTodayAndTomorrow = pendingResult.items.filter((f) => {
    const d = f.scheduled_departure_at.slice(0, 10);
    return d === todayDate || d === tomorrowDate;
  });

  const todayCounts = stats?.today;
  const scheduledToday = todayCounts?.scheduled ?? 0;
  const releasedToday = todayCounts?.released ?? 0;
  const totalToday = todayCounts?.total ?? todaysFlights.total;
  const cancelledToday = todayCounts?.cancelled ?? 0;
  const completedPct =
    totalToday > 0 ? Math.round((releasedToday / totalToday) * 1000) / 10 : 0;
  // Prefer real airworthiness rollup; fall back to ops aircraft_active
  // if maintenance is down.
  const fleetTotal =
    snapshot.fleetTotal > 0 ? snapshot.fleetTotal : stats?.aircraft_total ?? 0;
  const fleetActive =
    snapshot.fleetTotal > 0
      ? snapshot.fleetAirworthy
      : stats?.aircraft_active ?? 0;
  const fleetHold =
    snapshot.fleetTotal > 0
      ? snapshot.fleetGrounded
      : Math.max(0, fleetTotal - fleetActive);
  // Same default-full-credit / subtract-for-failures score model as the
  // executive dashboard (see ExecutiveDashboardPage). Completion + on-time
  // start at full credit, fleet airworthiness scales linearly, and the
  // M3 pillars (crew, safety) stay 0 until those services ship.
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

  const overdueCount = snapshot.alerts.filter(
    (a) => a.category === "flight_overdue",
  ).length;

  return (
    <div className="container py-6">
      <DashboardNav active="director-ops" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Director of Operations</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Real-time operational overview
          </p>
        </div>
        <ScorePill score={opsScore} />
      </div>

      {/* Row 1 — 6-col stat tiles. Airborne + Overdue come from the
          shared snapshot; the others derive from today's stats query. */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        <StatTile
          value={snapshot.airborneCount}
          label="Airborne"
          tone="blue"
        />
        <StatTile
          value={overdueCount}
          label="Overdue"
          tone={overdueCount > 0 ? "red" : "muted"}
        />
        <StatTile
          value={totalToday}
          label="Sched Today"
          sub={`${completedPct.toFixed(0)}%`}
          tone={totalToday > 0 ? "green" : "muted"}
        />
        <StatTile
          value={cancelledToday}
          label="Cancelled"
          tone={cancelledToday > 0 ? "red" : "muted"}
        />
        <StatTile
          value={fleetTotal > 0 ? fleetHold : 0}
          label="Fleet Hold"
          sub={`${fleetActive}/${fleetTotal} avail`}
          tone={fleetHold > 0 ? "orange" : "muted"}
        />
        <StatTile
          value={scheduledToday}
          label="Undispatched"
          sub="today + tomorrow"
          tone={scheduledToday > 0 ? "orange" : "muted"}
          href="/dispatch/"
        />
      </div>

      {/* Row 2 — 2-col: Alerts (left, narrow) + Active Flights (right) */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-[280px_1fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Alerts
          </h2>
          <AlertList
            alerts={snapshotAlertsToList(snapshot.alerts)}
            emptyHint="No active alerts from the wired sources. NOTAM / compliance / safety alerts populate here once their services ship in M3."
          />
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Flights
            </h2>
            <Link
              href="/dispatch/"
              className="text-[0.7rem] text-muted-foreground/70 hover:text-status-blue"
            >
              Open dispatch →
            </Link>
          </div>
          <FlightsTable flights={todaysFlights.items} />
        </section>
      </div>

      {/* Row 3 — 2-col: Pending Dispatch + 8-Week Completion Trend */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pending Dispatch
            </h2>
            <Link
              href="/dispatch/"
              className="rounded-md bg-primary px-3 py-1 text-[0.7rem] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              + New Packet
            </Link>
          </div>
          <FlightsTable
            flights={pendingTodayAndTomorrow}
            compact
            emptyHint="✅ All scheduled flights dispatched"
          />
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              8-Week Completion Trend
            </h2>
            <span className="text-[0.65rem] text-muted-foreground/70">
              flight-following · M2
            </span>
          </div>
          <CompletionTrendStub />
        </section>
      </div>

      {/* Row 4 — 3-col: Stations + Crew Compliance + Risk Distribution */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
        <ListPanel
          title="Station Summary"
          milestone="M2"
          rows={collectStations(todaysFlights.items)}
          emptyHint="No station traffic today."
        />
        <ListPanel
          title="Crew Compliance"
          milestone="M3"
          rows={[
            { left: "PICs current", right: "0/0" },
            { left: "SICs current", right: "0/0" },
            { left: "Expired this week", right: "0" },
            { left: "Expiring next 30d", right: "0" },
          ]}
        />
        <ListPanel
          title="Risk Distribution (14d)"
          milestone="M3"
          rows={[
            { left: "Low", right: "0", tone: "green" },
            { left: "Medium", right: "0", tone: "yellow" },
            { left: "High", right: "0", tone: "orange" },
            { left: "Extreme", right: "0", tone: "red" },
          ]}
        />
      </div>
    </div>
  );
}

function FlightsTable({
  flights,
  compact = false,
  emptyHint = "No flights to show.",
}: {
  flights: FlightListItem[];
  compact?: boolean;
  emptyHint?: string;
}) {
  if (flights.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground/70">
        {emptyHint}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <th className="px-2 py-2">Flight</th>
            <th className="px-2 py-2">Route</th>
            <th className="px-2 py-2">Tail</th>
            {!compact && <th className="px-2 py-2">Status</th>}
            <th className="px-2 py-2">STD</th>
            <th className="px-2 py-2 text-right">&nbsp;</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {flights.map((f) => (
            <tr key={f.id} className="border-b border-border/60 last:border-0">
              <td className="px-2 py-2 font-semibold text-foreground">{f.flight_number}</td>
              <td className="px-2 py-2 text-muted-foreground">
                {f.origin} → {f.destination}
              </td>
              <td className="px-2 py-2 text-foreground/90">{f.aircraft.tail_number}</td>
              {!compact && (
                <td className="px-2 py-2">
                  <FlightStatusBadge flight={f} />
                </td>
              )}
              <td className="px-2 py-2 text-foreground/80">
                {f.scheduled_departure_at.slice(11, 16)}Z
              </td>
              <td className="px-2 py-2 text-right">
                <Link
                  href={`/dispatch/${f.id}`}
                  className="text-status-blue hover:underline"
                >
                  →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Status pill for the Active Flights row — same color palette the Live
 * Ops Board on Executive uses, so the two tables read the same vibe.
 * "released" + actual_departure_at flips to the green "Airborne" pill.
 */
function FlightStatusBadge({ flight }: { flight: FlightListItem }) {
  const cls =
    "inline-flex items-center rounded bg-opacity-15 px-1.5 py-0.5 text-[0.65rem] font-semibold";
  if (flight.status === "released" && flight.actual_departure_at) {
    return (
      <span className={`${cls} bg-status-green/15 text-status-green`}>
        Airborne
      </span>
    );
  }
  if (flight.status === "released") {
    return (
      <span className={`${cls} bg-status-blue/15 text-status-blue`}>
        Released
      </span>
    );
  }
  if (flight.status === "cancelled") {
    return (
      <span className={`${cls} bg-status-red/15 text-status-red`}>
        Cancelled
      </span>
    );
  }
  if (flight.status === "completed") {
    return (
      <span className={`${cls} bg-muted/40 text-muted-foreground`}>
        Completed
      </span>
    );
  }
  return (
    <span className={`${cls} bg-muted/30 text-muted-foreground`}>
      Planned
    </span>
  );
}

function CompletionTrendStub() {
  // Show 8 week-start dates ending with the most recent Monday. Labels
  // read "MM/DD" — matches legacy's "W04/27", "W05/04" format but with
  // an explicit leading "W". Bars stay at 0% until flight-following
  // aggregation lands (M2 follow-up).
  const labels: string[] = [];
  const now = new Date();
  // Find this week's Monday (UTC). getUTCDay: Sun=0, Mon=1 ... Sat=6.
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
    labels.push(`W${mm}/${dd}`);
  }
  return (
    <div className="flex h-32 items-end justify-between gap-1">
      {labels.map((label) => (
        <div key={label} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t bg-muted" style={{ height: "8%" }} />
          <span className="text-[0.6rem] font-mono text-muted-foreground/60">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

interface ListRow {
  left: string;
  right: string;
  tone?: "green" | "yellow" | "orange" | "red";
}

function ListPanel({
  title,
  milestone,
  rows,
  emptyHint,
}: {
  title: string;
  milestone: "M2" | "M3" | "M4";
  rows: ListRow[];
  emptyHint?: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-muted-foreground">
          {milestone}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground/70">
          {emptyHint ?? "—"}
        </p>
      ) : (
        <ul className="space-y-1.5 text-xs">
          {rows.map((row, i) => (
            <li
              key={i}
              className="flex items-baseline justify-between border-b border-border/40 py-1 last:border-0"
            >
              <span className="text-foreground/80">{row.left}</span>
              <span
                className={
                  row.tone === "green"
                    ? "font-mono font-semibold text-status-green"
                    : row.tone === "yellow"
                      ? "font-mono font-semibold text-status-yellow"
                      : row.tone === "orange"
                        ? "font-mono font-semibold text-status-orange"
                        : row.tone === "red"
                          ? "font-mono font-semibold text-status-red"
                          : "font-mono text-foreground"
                }
              >
                {row.right}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function collectStations(flights: FlightListItem[]): ListRow[] {
  const counts = new Map<string, { dep: number; arr: number }>();
  for (const f of flights) {
    const dep = counts.get(f.origin) ?? { dep: 0, arr: 0 };
    dep.dep += 1;
    counts.set(f.origin, dep);
    const arr = counts.get(f.destination) ?? { dep: 0, arr: 0 };
    arr.arr += 1;
    counts.set(f.destination, arr);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 8)
    .map(([icao, c]) => ({
      left: icao,
      right: `${c.dep} dep · ${c.arr} arr`,
    }));
}
