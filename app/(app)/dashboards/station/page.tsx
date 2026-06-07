import Link from "next/link";

import { AlertList } from "@/components/dashboards/alert-list";
import { DashboardNav } from "@/components/dashboards/dashboard-nav";
import { StatTile } from "@/components/dashboards/stat-tile";
import { listFlights } from "@/lib/api/ops";
import type { FlightListItem } from "@/lib/api/types";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

interface SearchParams {
  station?: string;
}

export default async function StationDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { station: requestedStation } = await searchParams;
  const today = todayUtc();
  const todaysFlights = await listFlights({ onDate: today, limit: 200 }).catch(
    () => ({ items: [], total: 0 }),
  );

  // Collect unique ICAOs from origin + destination across today's flights
  const stations = new Set<string>();
  for (const f of todaysFlights.items) {
    stations.add(f.origin);
    stations.add(f.destination);
  }
  const stationList = Array.from(stations).sort();
  const station = requestedStation && stations.has(requestedStation)
    ? requestedStation
    : (stationList[0] ?? "PADU");

  const inbound = todaysFlights.items.filter((f) => f.destination === station);
  const outbound = todaysFlights.items.filter((f) => f.origin === station);
  const allAtStation = todaysFlights.items.filter(
    (f) => f.origin === station || f.destination === station,
  );

  return (
    <div className="container py-6">
      <DashboardNav active="station" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Station: <span className="font-mono">{station}</span>
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Per-station traffic, ground times, and turn metrics
          </p>
        </div>
        <StationSelector current={station} stations={stationList} />
      </div>

      {/* Row 1 — 4-col stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          value={outbound.length}
          label="Scheduled Departures"
          tone={outbound.length > 0 ? "blue" : "muted"}
        />
        <StatTile
          value={inbound.length}
          label="Scheduled Arrivals"
          tone={inbound.length > 0 ? "green" : "muted"}
        />
        <StatTile value={0} label="Inbound Now" sub="airborne to station" tone="muted" />
        <StatTile value={0} label="Outbound Now" sub="departed from station" tone="muted" />
      </div>

      {/* Row 2 — 2-col: Inbound table + Alerts */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Inbound Flights
          </h2>
          <StationFlightsTable flights={inbound} direction="in" />
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Active Alerts
            </h2>
            <span className="text-[0.65rem] text-muted-foreground/70">
              alerts-service · M3
            </span>
          </div>
          <AlertList
            alerts={[]}
            emptyHint={`No active alerts for ${station}. Station-scoped alerts (NOTAMs, weather, ramp issues) populate here once the alerts-service ships in M3.`}
          />
        </section>
      </div>

      {/* Row 3 — All active flights at this station */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            All Activity — <span className="font-mono">{station}</span>
          </h2>
          <Link
            href="/dispatch/"
            className="text-[0.7rem] text-muted-foreground/70 hover:text-status-blue"
          >
            Open dispatch →
          </Link>
        </div>
        <StationFlightsTable flights={allAtStation} direction="both" station={station} />
      </section>

      {/* Row 4 — Network overview */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Network Overview
        </h2>
        <NetworkGrid flights={todaysFlights.items} currentStation={station} />
      </section>
    </div>
  );
}

function StationSelector({
  current,
  stations,
}: {
  current: string;
  stations: string[];
}) {
  if (stations.length === 0) {
    return null;
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Station
      </span>
      <div className="flex gap-1">
        {stations.map((icao) => (
          <Link
            key={icao}
            href={`/dashboards/station/?station=${icao}`}
            className={
              icao === current
                ? "rounded-md bg-primary/12 px-2 py-0.5 font-mono text-xs font-semibold text-status-blue"
                : "rounded-md px-2 py-0.5 font-mono text-xs text-muted-foreground hover:bg-primary/8 hover:text-status-blue"
            }
            aria-current={icao === current ? "page" : undefined}
          >
            {icao}
          </Link>
        ))}
      </div>
    </div>
  );
}

function StationFlightsTable({
  flights,
  direction,
  station,
}: {
  flights: FlightListItem[];
  direction: "in" | "out" | "both";
  station?: string;
}) {
  if (flights.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground/70">
        No flights to show.
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
            {direction === "both" && <th className="px-2 py-2">Dir</th>}
            <th className="px-2 py-2">{direction === "in" ? "ETA" : "STD"}</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {flights.map((f) => (
            <tr key={f.id} className="border-b border-border/60 last:border-0">
              <td className="px-2 py-2 font-semibold text-foreground">
                <Link href={`/dispatch/${f.id}`} className="hover:text-status-blue">
                  {f.flight_number}
                </Link>
              </td>
              <td className="px-2 py-2 text-muted-foreground">
                {f.origin} → {f.destination}
              </td>
              <td className="px-2 py-2 text-foreground/90">{f.aircraft.tail_number}</td>
              {direction === "both" && (
                <td className="px-2 py-2">
                  {station && f.origin === station ? (
                    <span className="text-status-blue">↑ out</span>
                  ) : (
                    <span className="text-status-green">↓ in</span>
                  )}
                </td>
              )}
              <td className="px-2 py-2 text-foreground/80">
                {direction === "in"
                  ? f.scheduled_arrival_at.slice(11, 16) + "Z"
                  : f.scheduled_departure_at.slice(11, 16) + "Z"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NetworkGrid({
  flights,
  currentStation,
}: {
  flights: FlightListItem[];
  currentStation: string;
}) {
  const counts = new Map<string, { dep: number; arr: number }>();
  for (const f of flights) {
    const dep = counts.get(f.origin) ?? { dep: 0, arr: 0 };
    dep.dep += 1;
    counts.set(f.origin, dep);
    const arr = counts.get(f.destination) ?? { dep: 0, arr: 0 };
    arr.arr += 1;
    counts.set(f.destination, arr);
  }
  const entries = Array.from(counts.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  if (entries.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground/70">
        No station traffic today.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {entries.map(([icao, c]) => (
        <Link
          key={icao}
          href={`/dashboards/station/?station=${icao}`}
          className={
            "rounded-md border p-3 text-xs transition-colors " +
            (icao === currentStation
              ? "border-status-blue/40 bg-status-blue/[0.08]"
              : "border-border bg-card hover:border-primary/30")
          }
        >
          <p className="font-mono font-semibold text-foreground">{icao}</p>
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            {c.dep} dep · {c.arr} arr
          </p>
        </Link>
      ))}
    </div>
  );
}
