import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { AlertList } from "@/components/dashboards/alert-list";
import { DashboardNav } from "@/components/dashboards/dashboard-nav";
import { FleetAirworthinessPanel } from "@/components/dashboards/fleet-airworthiness-panel";
import { StatTile } from "@/components/dashboards/stat-tile";
import { listFlights, getFlightStats } from "@/lib/api/ops";
import { loadOperationalSnapshot } from "@/lib/dashboards/operational-snapshot";
import { snapshotAlertsToList } from "@/lib/dashboards/snapshot-to-alerts";
import type { FlightListItem } from "@/lib/api/types";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function DispatcherDashboardPage() {
  const today = todayUtc();
  const [stats, todaysFlights, pendingResult, snapshot] = await Promise.all([
    getFlightStats().catch(() => null),
    listFlights({ onDate: today }).catch(() => ({ items: [], total: 0 })),
    // Wider window then filter to today + tomorrow — same fix as
    // director-ops. Bare status='scheduled' picks up orphan rows from
    // prior seed runs.
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

  const scheduledToday = stats?.today.scheduled ?? 0;
  const overdueCount = snapshot.alerts.filter(
    (a) => a.category === "flight_overdue",
  ).length;
  // Real airworthiness rollup first; fall back to ops aircraft_active.
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

  return (
    <div className="container py-6">
      <DashboardNav active="dispatcher" />

      <h1 className="text-xl font-bold tracking-tight">Dispatcher Live View</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Active flights · crew legality · pending dispatch packets
      </p>

      {/* Row 1 — 5-col stat tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <StatTile
          value={snapshot.airborneCount}
          label="Airborne"
          tone={snapshot.airborneCount > 0 ? "blue" : "muted"}
        />
        <StatTile
          value={overdueCount}
          label="Overdue"
          sub="immediate attention"
          tone={overdueCount > 0 ? "red" : "muted"}
        />
        <StatTile
          value={scheduledToday}
          label="Need Dispatch"
          sub="today + tomorrow"
          tone={scheduledToday > 0 ? "orange" : "muted"}
          href="/dispatch/"
        />
        <StatTile
          value={fleetGrounded}
          label="Fleet Hold"
          sub={`${fleetActive}/${fleetTotal} avail`}
          tone={fleetGrounded > 0 ? "orange" : "muted"}
        />
        <StatTile
          value={0}
          label="Crew Expired"
          sub="check before dispatch"
          tone="muted"
        />
      </div>

      {/* Row 2 — alerts */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Active Alerts
          </h2>
          <span className="text-[0.65rem] text-muted-foreground/70">
            {snapshot.alerts.length} live · 7 more land with M3 services
          </span>
        </div>
        <AlertList
          alerts={snapshotAlertsToList(snapshot.alerts)}
          emptyHint="No active alerts from the wired sources. Overdue flights, MELs about to expire, and grounded aircraft show up here; expired currency / NOTAM alerts land with M3 services."
        />
      </section>

      {/* Row 3 — Live Ops Board */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Live Ops Board
          </h2>
          <Link
            href="/flight-following"
            className="text-[0.7rem] text-muted-foreground/70 hover:text-status-blue"
          >
            Full following →
          </Link>
        </div>
        <LiveOpsTable flights={todaysFlights.items} />
      </section>

      {/* Row 4 — 2-col: Pending dispatch + Fleet Availability */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Flights Needing Dispatch
            </h2>
            <Link
              href="/dispatch/"
              className="rounded-md bg-primary px-3 py-1 text-[0.7rem] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              + New Packet
            </Link>
          </div>
          <PendingDispatchTable flights={pendingTodayAndTomorrow} />
        </section>

        <FleetAirworthinessPanel
          fleet={snapshot.fleet}
          title="Fleet Availability"
        />
      </div>

      {/* Row 5 — 3-col footer panels (all backed by services not yet built) */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
        <FuturePanel
          title="Crew Currency"
          milestone="M3"
          hint="Per-PIC currency snapshot (90-day landings, IPC, recurrent) once crew-service ships."
        />
        <FuturePanel
          title="Risk Distribution (7d)"
          milestone="M3"
          hint="Bar chart of LOW / MEDIUM / HIGH / EXTREME risk scores across the last 7 days once risk-analytics is wired."
        />
        <RecentOutcomesPanel />
      </div>
    </div>
  );
}

function RecentOutcomesPanel() {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Recent Outcomes
        </h2>
        <Link
          href="/flight-following/history"
          className="text-[0.7rem] text-muted-foreground/70 hover:text-status-blue"
        >
          Dispatch history →
        </Link>
      </div>
      <p className="py-4 text-center text-xs text-muted-foreground/70">
        No outcomes recorded yet.
      </p>
    </section>
  );
}

function LiveOpsTable({ flights }: { flights: FlightListItem[] }) {
  if (flights.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground/70">
        No flights scheduled today.
      </p>
    );
  }

  // Columns mirror legacy peregrineflight verbatim:
  // FLIGHT / TAIL / ROUTE / PIC / STATUS / ETD / ATD / ETA / CONTACT.
  // PIC stays "—" until crew-service ships (M3). ATD reads from
  // actual_departure_at; CONTACT from a future position-tracker. Both
  // null-safe with "—" fallback.
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <th className="px-2 py-2">Flight</th>
            <th className="px-2 py-2">Tail</th>
            <th className="px-2 py-2">Route</th>
            <th className="px-2 py-2">PIC</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">ETD</th>
            <th className="px-2 py-2">ATD</th>
            <th className="px-2 py-2">ETA</th>
            <th className="px-2 py-2">Contact</th>
            <th className="px-2 py-2 text-right">&nbsp;</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {flights.map((f) => (
            <tr key={f.id} className="border-b border-border/60 last:border-0">
              <td className="px-2 py-2 font-semibold text-foreground">{f.flight_number}</td>
              <td className="px-2 py-2 text-foreground/90">{f.aircraft.tail_number}</td>
              <td className="px-2 py-2 text-muted-foreground">
                {f.origin}→{f.destination}
              </td>
              <td className="px-2 py-2 text-muted-foreground/60">—</td>
              <td className="px-2 py-2">
                <StatusPill flight={f} />
              </td>
              <td className="px-2 py-2 text-foreground/80">
                {formatTime(f.scheduled_departure_at)}
              </td>
              <td className="px-2 py-2 text-foreground/80">
                {f.actual_departure_at
                  ? formatTime(f.actual_departure_at)
                  : "—"}
              </td>
              <td className="px-2 py-2 text-foreground/80">
                {formatTime(f.scheduled_arrival_at)}
              </td>
              <td className="px-2 py-2 text-muted-foreground/60">—</td>
              <td className="px-2 py-2 text-right">
                <Link href={`/dispatch/${f.id}`} className="text-status-blue hover:underline">
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

function PendingDispatchTable({ flights }: { flights: FlightListItem[] }) {
  if (flights.length === 0) {
    return (
      <p className="inline-flex w-full items-center justify-center gap-1.5 py-6 text-center text-xs text-muted-foreground/70">
        <CheckCircle2
          className="h-3.5 w-3.5 text-status-green"
          aria-hidden
        />
        All scheduled flights have dispatch packets
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
            <th className="px-2 py-2">Dep</th>
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
              <td className="px-2 py-2 text-foreground/80">{formatTime(f.scheduled_departure_at)}</td>
              <td className="px-2 py-2 text-right">
                <Link
                  href={`/dispatch/?flight=${f.id}`}
                  className="text-[0.7rem] font-medium text-status-blue hover:underline"
                >
                  Dispatch →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FuturePanel({
  title,
  milestone,
  hint,
}: {
  title: string;
  milestone: "M2" | "M3" | "M4";
  hint: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <span
          className="rounded-md bg-muted px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.06em] text-muted-foreground"
          title={`Coming in ${milestone}`}
        >
          {milestone}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </section>
  );
}

function StatusPill({ flight }: { flight: FlightListItem }) {
  // Same status taxonomy as the executive/director Live Ops Board so
  // dispatch reads the same vibe across dashboards.
  const isAirborne =
    flight.status === "released" && flight.actual_departure_at;
  const label = isAirborne
    ? "Airborne"
    : flight.status === "scheduled"
      ? "Planned"
      : flight.status.charAt(0).toUpperCase() + flight.status.slice(1);
  const styles = isAirborne
    ? "bg-status-green/15 text-status-green"
    : flight.status === "released"
      ? "bg-status-blue/15 text-status-blue"
      : flight.status === "cancelled"
        ? "bg-status-red/15 text-status-red"
        : flight.status === "completed"
          ? "bg-muted text-muted-foreground"
          : "bg-muted/40 text-muted-foreground";
  return (
    <span
      className={
        "inline-flex rounded-md px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.06em] " +
        styles
      }
    >
      {label}
    </span>
  );
}

function formatTime(iso: string): string {
  return iso.slice(11, 16) + "Z";
}
