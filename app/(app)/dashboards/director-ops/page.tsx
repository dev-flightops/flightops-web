import Link from "next/link";

import { PageHeader } from "@/components/ff/page-header";
import { CheckGlyph } from "@/components/ff/glyphs";
import { AlertList } from "@/components/dashboards/alert-list";
import { CompletionTrendNotMeasured } from "@/components/dashboards/completion-trend-not-measured";
import { ScorePill } from "@/components/dashboards/score-pill";
import { StatTile } from "@/components/dashboards/stat-tile";
import { listFlights, getFlightStats } from "@/lib/api/ops";
import { loadOperationalSnapshot } from "@/lib/dashboards/operational-snapshot";
import { snapshotAlertsToList } from "@/lib/dashboards/snapshot-to-alerts";
import type { FlightListItem } from "@/lib/api/types";
import { LoadFailedNotice } from "@/components/ff/setup-notice";
import { Loads } from "@/lib/api/loads";
import { DEFAULT_TIME_ZONE, localDay } from "@/lib/format/local-time";

export default async function DirectorOpsDashboardPage() {
  // The company's day (#157), as the board and the schedule have it.
  const today = localDay(DEFAULT_TIME_ZONE);
  // #138: flights that didn't load say so; they had read as a quiet day.
  const loads = new Loads();
  const [stats, todaysFlights, pendingResult, snapshot] = await Promise.all([
    getFlightStats().catch(() => null),
    loads.or(listFlights({ onCompanyDate: today }), { items: [], total: 0 }, "today’s flights"),
    // Pull a wider window then filter to today + tomorrow client-side —
    // the API doesn't have a date-range param yet, and a bare
    // status='scheduled' query also picks up orphaned old-date rows
    // from prior seed runs. Mirrors legacy's "today + tomorrow" scope.
    loads.or(listFlights({ status: "scheduled", limit: 50 }), { items: [], total: 0 }, "the scheduled flights"),
    loadOperationalSnapshot(),
  ]);

  const todayDate = today;
  const tomorrowDate = localDay(DEFAULT_TIME_ZONE, new Date(Date.now() + 24 * 60 * 60 * 1000));
  const pendingTodayAndTomorrow = pendingResult.items.filter((f) => {
    const d = localDay(DEFAULT_TIME_ZONE, new Date(f.scheduled_departure_at));
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

      <PageHeader
        title="Director of Operations"
        description="Real-time operational overview"
        actions={<ScorePill score={opsScore} />}
      />

      <LoadFailedNotice what={loads.failed} className="mb-4" />

      {/* Row 1 — 6-col stat tiles. Airborne + Overdue come from the
          shared snapshot; the others derive from today's stats query. */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 md:grid-cols-6">
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
      <div className="mt-6 grid grid-cols-1 items-start gap-5 md:grid-cols-[280px_1fr]">
        <section className="overflow-hidden rounded-lg border border-border bg-card p-5">
          <h2 className="panel-title -mx-5 -mt-5 mb-4 border-b border-border px-5 py-3">
            Alerts
          </h2>
          <AlertList
            alerts={snapshotAlertsToList(snapshot.alerts)}
            emptyHint="No grounded aircraft, overdue flights or MELs expiring in the next two days."
          />
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-card p-5">
          <div className="-mx-5 -mt-5 mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
            <h2 className="panel-title">
              Active Flights
            </h2>
            <Link
              href="/dispatch/"
              className="text-[0.7rem] text-muted-foreground hover:text-primary"
            >
              Open dispatch →
            </Link>
          </div>
          <FlightsTable flights={todaysFlights.items} />
        </section>
      </div>

      {/* Row 3 — 2-col: Pending Dispatch + 8-Week Completion Trend */}
      <div className="mt-6 grid grid-cols-1 items-start gap-5 md:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-border bg-card p-5">
          <div className="-mx-5 -mt-5 mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
            <h2 className="panel-title">
              Pending Dispatch
            </h2>
            <Link
              href="/dispatch/"
              className="btn-caps rounded-md bg-primary px-3 py-1 text-primary-foreground hover:bg-brand-dark text-[0.68rem]"
            >
              + New Packet
            </Link>
          </div>
          <FlightsTable
            flights={pendingTodayAndTomorrow}
            compact
            emptyHint={
              <span className="inline-flex items-center gap-1.5">
                <CheckGlyph
                  className="h-3.5 w-3.5 text-status-green"
                  aria-hidden
                />
                All scheduled flights dispatched
              </span>
            }
          />
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-card p-5">
          <div className="-mx-5 -mt-5 mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
            <h2 className="panel-title">
              8-Week Completion Trend
            </h2>
            <span className="text-[0.65rem] text-muted-foreground">
              not computed
            </span>
          </div>
          <CompletionTrendNotMeasured />
        </section>
      </div>

      {/* Row 4 — stations. Crew Compliance and Risk Distribution had
          printed hardcoded zeros, then "Not built yet" (#157); they aren't
          shown until they read something. */}
      <div className="mt-6 grid grid-cols-1 items-start gap-5 md:grid-cols-3">
        <ListPanel
          title="Station Summary"
          rows={collectStations(todaysFlights.items)}
          emptyHint="No station traffic today."
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
  emptyHint?: React.ReactNode;
}) {
  if (flights.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        {emptyHint}
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
                  className="text-primary hover:underline"
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
    "status-mark";
  if (flight.status === "released" && flight.actual_departure_at) {
    return (
      <span className={`${cls} text-status-green`}>
        Airborne
      </span>
    );
  }
  if (flight.status === "released") {
    return (
      <span className={`${cls} text-status-blue`}>
        Released
      </span>
    );
  }
  if (flight.status === "cancelled") {
    return (
      <span className={`${cls} text-status-red`}>
        Cancelled
      </span>
    );
  }
  if (flight.status === "completed") {
    return (
      <span className={`${cls} text-muted-foreground`}>
        Completed
      </span>
    );
  }
  return (
    <span className={`${cls} text-muted-foreground`}>
      Planned
    </span>
  );
}

interface ListRow {
  left: string;
  /** Right-side value. ReactNode so callers can compose styled spans
   *  (color-coded dep/arr counts on the Station Summary panel use
   *  this; the other panels still pass plain strings). */
  right: React.ReactNode;
  tone?: "green" | "yellow" | "orange" | "red";
}

function ListPanel({
  title,
  rows,
  emptyHint,
}: {
  title: string;
  rows: ListRow[];
  emptyHint?: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card p-5">
      <div className="-mx-5 -mt-5 mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
        <h2 className="panel-title">
          {title}
        </h2>
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          {emptyHint ?? "—"}
        </p>
      ) : (
        // Row separator dropped + padding bumped from py-1 to py-2 —
        // borders between rows clashed with the panel's outer border
        // and made the list read as a table; legacy uses whitespace
        // alone for the row rhythm. Values are sans-serif except for
        // tonal status numbers (green/yellow/orange/red), where mono
        // keeps numeric width consistent across the column.
        <ul className="space-y-1 text-xs">
          {rows.map((row, i) => (
            <li
              key={i}
              className="flex items-baseline justify-between py-2"
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
                          : "font-semibold text-foreground"
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
  // Departures + arrivals color-coded — blue for outbound (matches
  // the StatTile + dep arrows elsewhere) and green for inbound
  // (matches the Inbound Now tile on /dashboards/station). Mirrors
  // legacy peregrineflight's color treatment on the same panel; the
  // muted "·" + "dep"/"arr" labels keep the row scannable.
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 8)
    .map(([icao, c]) => ({
      left: icao,
      right: (
        <span className="font-mono">
          <span className="font-semibold text-primary">{c.dep}</span>
          <span className="font-normal text-muted-foreground">
            {" dep · "}
          </span>
          <span className="font-semibold text-status-green">{c.arr}</span>
          <span className="font-normal text-muted-foreground">
            {" arr"}
          </span>
        </span>
      ),
    }));
}
