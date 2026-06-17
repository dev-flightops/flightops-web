import Link from "next/link";

import { AlertList } from "@/components/dashboards/alert-list";
import { DashboardNav } from "@/components/dashboards/dashboard-nav";
import { StationPicker } from "@/components/dashboards/station-picker";
import { StatTile } from "@/components/dashboards/stat-tile";
import { listCompanyBases } from "@/lib/api/auth";
import { listFlights } from "@/lib/api/ops";
import {
  loadOperationalSnapshot,
  scopeSnapshotToIcao,
} from "@/lib/dashboards/operational-snapshot";
import { snapshotAlertsToList } from "@/lib/dashboards/snapshot-to-alerts";
import type { CompanyBaseResponse, FlightListItem } from "@/lib/api/types";

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
  const [todaysFlights, snapshot, basesResponse] = await Promise.all([
    listFlights({ onDate: today, limit: 200 }).catch(() => ({
      items: [],
      total: 0,
    })),
    loadOperationalSnapshot(),
    // Full bases catalog drives both the dropdown picker and the
    // network grid — same source legacy uses. Falls back to today's
    // traffic stations if the catalog query fails.
    listCompanyBases().catch(() => ({ items: [], total: 0 })),
  ]);

  // Bases sorted by ICAO — drives the <select> and the network grid.
  const bases = [...basesResponse.items].sort((a, b) =>
    a.icao.localeCompare(b.icao),
  );
  const baseIcaos = new Set(bases.map((b) => b.icao));
  const station =
    requestedStation && baseIcaos.has(requestedStation)
      ? requestedStation
      : (bases[0]?.icao ?? "PADU");

  // Scope live alerts to this base — overdue flights at this origin
  // surface, MEL / grounded aircraft alerts (which aren't ICAO-scoped)
  // pass through so dispatchers see them on every base view.
  const scopedSnapshot = scopeSnapshotToIcao(snapshot, station);

  const inbound = todaysFlights.items.filter((f) => f.destination === station);
  const outbound = todaysFlights.items.filter((f) => f.origin === station);
  const allAtStation = todaysFlights.items.filter(
    (f) => f.origin === station || f.destination === station,
  );

  // Airborne legs scoped to this station: an inbound is "Inbound Now"
  // when it has departed (status=released + actual_departure_at set) but
  // hasn't landed yet. Same shape for outbound but at the origin side.
  const isAirborne = (f: FlightListItem) =>
    f.status === "released" && f.actual_departure_at && !f.actual_arrival_at;
  const inboundNow = inbound.filter(isAirborne).length;
  const outboundNow = outbound.filter(isAirborne).length;

  // Outbound "departed" and inbound "landed" counters for the tile subs —
  // anything with an actual_departure_at / actual_arrival_at counts.
  const outboundDeparted = outbound.filter((f) => f.actual_departure_at).length;
  const inboundLanded = inbound.filter((f) => f.actual_arrival_at).length;

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
        <StationPicker
          current={station}
          options={bases.map((b) => ({
            icao: b.icao,
            label: `${b.icao} — ${b.display_name}`,
          }))}
        />
      </div>

      {/* Row 1 — 4-col stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          value={outbound.length}
          label="Scheduled Departures"
          sub={`${outboundDeparted} departed`}
          tone={outbound.length > 0 ? "blue" : "muted"}
        />
        <StatTile
          value={inbound.length}
          label="Scheduled Arrivals"
          sub={`${inboundLanded} landed`}
          tone={inbound.length > 0 ? "green" : "muted"}
        />
        <StatTile
          value={inboundNow}
          label="Inbound Now"
          sub="en route"
          tone={inboundNow > 0 ? "blue" : "muted"}
        />
        <StatTile
          value={outboundNow}
          label="Outbound Now"
          sub="airborne"
          tone={outboundNow > 0 ? "blue" : "muted"}
        />
      </div>

      {/* Row 2 — 2-col: Inbound table + Alerts */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Inbound Flights
          </h2>
          <StationFlightsTable flights={inbound} direction="in" />
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Alerts
            </h2>
            <span className="text-[0.65rem] text-muted-foreground/70">
              {scopedSnapshot.alerts.length} live · NOTAM / weather alerts land with M3
            </span>
          </div>
          <AlertList
            alerts={snapshotAlertsToList(scopedSnapshot.alerts)}
            emptyHint={`No active alerts scoped to ${station}. Station-only alerts (NOTAMs, weather, ramp issues) populate here once their services ship.`}
          />
        </section>
      </div>

      {/* Row 3 — All active flights at this station */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            All Active Flights
          </h2>
          <Link
            href="/dispatch/"
            className="text-[0.7rem] text-muted-foreground/70 hover:text-status-blue"
          >
            Open dispatch →
          </Link>
        </div>
        <StationFlightsTable
          flights={allAtStation}
          direction="both"
          station={station}
        />
      </section>

      {/* Row 4 — Network station summary (all bases, not just today's traffic) */}
      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Network Station Summary — Today
        </h2>
        <NetworkGrid
          bases={bases}
          flights={todaysFlights.items}
          currentStation={station}
        />
      </section>
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
  bases,
  flights,
  currentStation,
}: {
  bases: CompanyBaseResponse[];
  flights: FlightListItem[];
  currentStation: string;
}) {
  // Tally departures + arrivals per ICAO from today's board.
  const counts = new Map<string, { dep: number; arr: number; inbound: number }>();
  for (const f of flights) {
    const dep = counts.get(f.origin) ?? { dep: 0, arr: 0, inbound: 0 };
    dep.dep += 1;
    counts.set(f.origin, dep);
    const arr = counts.get(f.destination) ?? { dep: 0, arr: 0, inbound: 0 };
    arr.arr += 1;
    // Inbound = currently airborne, destined here.
    if (f.status === "released" && f.actual_departure_at && !f.actual_arrival_at) {
      arr.inbound += 1;
    }
    counts.set(f.destination, arr);
  }

  if (bases.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground/70">
        No bases configured. Add bases in Settings → Bases.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
      {bases.map((b) => {
        const c = counts.get(b.icao) ?? { dep: 0, arr: 0, inbound: 0 };
        return (
          <Link
            key={b.icao}
            href={`/dashboards/station/?station=${b.icao}`}
            className={
              "rounded-md border p-3 text-xs transition-colors " +
              (b.icao === currentStation
                ? "border-status-blue/40 bg-status-blue/[0.08]"
                : "border-border bg-card hover:border-primary/30")
            }
          >
            <p className="font-mono font-semibold text-foreground">{b.icao}</p>
            <p className="mt-1 text-[0.65rem] text-muted-foreground">
              <span className="text-status-blue/80">↑ {c.dep} dep</span>{" "}
              <span className="text-status-green/80">↓ {c.arr} arr</span>
            </p>
            {c.inbound > 0 && (
              <p className="mt-0.5 text-[0.6rem] text-status-blue">
                ✈ {c.inbound} inbound
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
