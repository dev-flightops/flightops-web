import Link from "next/link";

import { PageHeader } from "@/components/ff/page-header";
import { CheckGlyph } from "@/components/ff/glyphs";
import { AlertList } from "@/components/dashboards/alert-list";
import { FleetAirworthinessPanel } from "@/components/dashboards/fleet-airworthiness-panel";
import { StatTile } from "@/components/dashboards/stat-tile";
import { listFlights, getFlightStats } from "@/lib/api/ops";
import { loadOperationalSnapshot } from "@/lib/dashboards/operational-snapshot";
import { snapshotAlertsToList } from "@/lib/dashboards/snapshot-to-alerts";
import type { FlightListItem } from "@/lib/api/types";
import { LoadFailedNotice } from "@/components/ff/setup-notice";
import { Loads } from "@/lib/api/loads";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function DispatcherDashboardPage() {
  const today = todayUtc();
  // #138: flights that didn't load say so; they had read as a quiet day.
  const loads = new Loads();
  const [stats, todaysFlights, pendingResult, snapshot] = await Promise.all([
    getFlightStats().catch(() => null),
    loads.or(listFlights({ onDate: today }), { items: [], total: 0 }, "today’s flights"),
    // Wider window then filter to today + tomorrow — same fix as
    // director-ops. Bare status='scheduled' picks up orphan rows from
    // prior seed runs.
    loads.or(listFlights({ status: "scheduled", limit: 50 }), { items: [], total: 0 }, "the scheduled flights"),
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

      <PageHeader
        title="Dispatcher Live View"
        description="Active flights · crew legality · pending dispatch packets"
      />

      <LoadFailedNotice what={loads.failed} className="mb-4" />

      {/* Row 1 — 5-col stat tiles */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 md:grid-cols-5">
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
        {/* This read "0 Crew Expired — check before dispatch" from a
            hardcoded zero: false reassurance on the one check it names.
            Not wired, so it says so; currency is on Fleet Compliance. */}
        <StatTile value="—" label="Crew Expired" sub="Not built yet" tone="muted" />
      </div>

      {/* Row 2 — alerts */}
      <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card p-5">
        <div className="-mx-5 -mt-5 mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
          <h2 className="panel-title">Active Alerts</h2>
          <span className="text-[0.65rem] text-muted-foreground">
            {snapshot.alerts.length} live · 6 more alert types land with their services
          </span>
        </div>
        <AlertList
          alerts={snapshotAlertsToList(snapshot.alerts)}
          emptyHint="No active alerts from the wired sources. Overdue flights, MELs about to expire, and grounded aircraft show up here; expired currency / NOTAM alerts land with M3 services."
        />
      </section>

      {/* Row 3 — Live Ops Board */}
      <section className="mt-5 rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="panel-title">
            Live Ops Board
          </h2>
          <Link
            href="/flight-following"
            className="text-[0.7rem] text-muted-foreground hover:text-primary"
          >
            Full following →
          </Link>
        </div>
        <LiveOpsTable flights={todaysFlights.items} />
      </section>

      {/* Row 4 — 2-col: Pending dispatch + Fleet Availability */}
      <div className="mt-6 grid grid-cols-1 items-start gap-5 md:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-border bg-card p-5">
          <div className="-mx-5 -mt-5 mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
            <h2 className="panel-title">
              Flights Needing Dispatch
            </h2>
            <Link
              href="/dispatch/"
              className="btn-caps rounded-md bg-primary px-3 py-1 text-primary-foreground hover:bg-brand-dark text-[0.68rem]"
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
      <div className="mt-6 grid grid-cols-1 items-start gap-5 md:grid-cols-3">
        <FuturePanel
          title="Crew Currency"
          hint="Not built here yet — pilot currency is on Fleet Compliance."
        />
        <FuturePanel title="Risk Distribution (7d)" hint="Not built yet." />
        <RecentOutcomesPanel />
      </div>
    </div>
  );
}

function RecentOutcomesPanel() {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="panel-title">
          Recent Outcomes
        </h2>
        <Link
          href="/flight-following/history"
          className="text-[0.7rem] text-muted-foreground hover:text-primary"
        >
          Dispatch history →
        </Link>
      </div>
      <p className="py-4 text-center text-xs text-muted-foreground">
        No outcomes recorded yet.
      </p>
    </section>
  );
}

function LiveOpsTable({ flights }: { flights: FlightListItem[] }) {
  if (flights.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
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
          <tr className="ff-thead">
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
              <td className="px-2 py-2 text-muted-foreground">—</td>
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
              <td className="px-2 py-2 text-muted-foreground">—</td>
              <td className="px-2 py-2 text-right">
                <Link href={`/dispatch/${f.id}`} className="text-primary hover:underline">
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
      <p className="inline-flex w-full items-center justify-center gap-1.5 py-6 text-center text-xs text-muted-foreground">
        <CheckGlyph
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
          <tr className="ff-thead">
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
                  className="text-[0.7rem] font-medium text-primary hover:underline"
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

function FuturePanel({ title, hint }: { title: string; hint: string }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="panel-title">
          {title}
        </h2>
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
    ? "text-status-green"
    : flight.status === "released"
      ? "text-status-blue"
      : flight.status === "cancelled"
        ? "text-status-red"
        : flight.status === "completed"
          ? "text-muted-foreground"
          : "text-muted-foreground";
  return (
    <span
      className={
        "status-mark " +
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
