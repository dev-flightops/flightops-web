import Link from "next/link";

import { StatusBadge } from "@/components/flight-following/status-badge";
import { AircraftFilter } from "@/components/maintenance/aircraft-filter";
import { StatusFilterTabs } from "@/components/maintenance/status-filter-tabs";
import { ApiError } from "@/lib/api/client";
import { listAircraft, listFlights } from "@/lib/api/ops";
import type {
  AircraftListItem,
  FlightListItem,
} from "@/lib/api/types";
import { formatBoth } from "@/lib/format/flight-time";

/**
 * /flight-following/history — terminal-status flight history.
 *
 * Layered progression:
 *   M2-G-14   — first cut: scheduled-times only, no filters
 *   M2-G-26b  — absorbed the range + aircraft filter and ATD/ATA
 *               actuals from the M2-G-26 standalone page (which got
 *               rebuilt as the legacy electronic-log landing). The
 *               historical-view feature didn't disappear, just moved
 *               to its right home.
 *
 * URL-driven state:
 *   ?range=week|month|quarter|all  (default: month — the legacy
 *                                  history page felt narrow at 7
 *                                  days for an audit-ish view)
 *   ?aircraft=<aircraft-id>        (default: all)
 *
 * Backend supports multi-status: this hits ?status=completed&status=
 * cancelled in a single round-trip (M2-M-15). Range + aircraft are
 * applied client-side after the fetch — fine at the demo scale.
 */

type Range = "week" | "month" | "quarter" | "all";
const RANGE_VALUES: Range[] = ["week", "month", "quarter", "all"];

function parseRange(raw: string | undefined): Range {
  return RANGE_VALUES.includes(raw as Range) ? (raw as Range) : "month";
}

function rangeStart(now: number, range: Range): number | null {
  const DAY = 24 * 60 * 60 * 1000;
  if (range === "week") return now - 7 * DAY;
  if (range === "month") return now - 30 * DAY;
  if (range === "quarter") return now - 90 * DAY;
  return null;
}

const HISTORY_LIMIT = 200;

export default async function FlightFollowingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; aircraft?: string }>;
}) {
  const { range: rangeParam, aircraft: aircraftParam } = await searchParams;
  const range = parseRange(rangeParam);
  const activeAircraftId = aircraftParam ?? null;

  let flights: FlightListItem[] = [];
  let aircraft: AircraftListItem[] = [];
  let loadError: string | null = null;

  try {
    const [flightsResult, aircraftResult] = await Promise.all([
      listFlights({
        status: ["completed", "cancelled"],
        limit: HISTORY_LIMIT,
      }),
      listAircraft(),
    ]);
    flights = flightsResult.items;
    aircraft = aircraftResult.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Flight history unavailable. Try refreshing in a moment.";
  }

  const now = Date.now();
  const startMs = rangeStart(now, range);

  const filtered = flights.filter((f) => {
    if (activeAircraftId && f.aircraft.id !== activeAircraftId) return false;
    if (startMs !== null) {
      const reference = f.actual_arrival_at ?? f.scheduled_arrival_at;
      if (Date.parse(reference) < startMs) return false;
    }
    return true;
  });

  // Newest first.
  filtered.sort((a, b) => {
    const aT = Date.parse(a.actual_arrival_at ?? a.scheduled_arrival_at);
    const bT = Date.parse(b.actual_arrival_at ?? b.scheduled_arrival_at);
    return bT - aT;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link
          href="/flight-following"
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Flight Following
        </Link>
        <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
          Flight History
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Completed and cancelled flights with real ATD / ATA + flown
          block hours. Filter by date range and tail.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <StatusFilterTabs<Range>
          basePath="/flight-following/history"
          options={[
            { value: "week", label: "Past 7 days" },
            { value: "month", label: "Past 30 days" },
            { value: "quarter", label: "Past 90 days" },
            { value: "all", label: "All time" },
          ]}
          activeStatus={range}
          aircraftId={activeAircraftId ?? undefined}
        />
        <AircraftFilter
          basePath="/flight-following/history"
          aircraft={aircraft}
          activeAircraftId={activeAircraftId}
          activeStatus={range}
        />
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No completed or cancelled flights in this range.
          </p>
        </div>
      ) : (
        <FlightHistoryTable flights={filtered} />
      )}
    </div>
  );
}

function FlightHistoryTable({ flights }: { flights: FlightListItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted/30">
          <tr className="text-left text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <th className="px-3 py-2">Flight</th>
            <th className="px-3 py-2">Aircraft</th>
            <th className="px-3 py-2">Route</th>
            <th className="px-3 py-2">ETD</th>
            <th className="px-3 py-2">ATD</th>
            <th className="px-3 py-2">ETA</th>
            <th className="px-3 py-2">ATA</th>
            <th className="px-3 py-2">Block</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f) => (
            <FlightHistoryRow key={f.id} flight={f} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlightHistoryRow({ flight }: { flight: FlightListItem }) {
  const etd = formatBoth(flight.scheduled_departure_at);
  const eta = formatBoth(flight.scheduled_arrival_at);

  return (
    <tr className="border-t border-border hover:bg-muted/20">
      <td className="px-3 py-2.5 font-semibold text-foreground">
        {flight.flight_number || "—"}
      </td>
      <td className="px-3 py-2.5">
        <div className="font-mono text-foreground">
          {flight.aircraft.tail_number}
        </div>
        <div className="text-[0.65rem] text-muted-foreground">
          {flight.aircraft.model}
        </div>
      </td>
      <td className="px-3 py-2.5 font-mono">
        {flight.origin}
        <span className="text-muted-foreground"> → </span>
        {flight.destination}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        <div className="font-mono">{etd.local}</div>
        <div className="font-mono text-[0.6rem] opacity-80">{etd.zulu}</div>
      </td>
      <ActualTimeCell actualIso={flight.actual_departure_at ?? null} />
      <td className="px-3 py-2.5 text-muted-foreground">
        <div className="font-mono">{eta.local}</div>
        <div className="font-mono text-[0.6rem] opacity-80">{eta.zulu}</div>
      </td>
      <ActualTimeCell actualIso={flight.actual_arrival_at ?? null} />
      <td className="px-3 py-2.5 font-mono">{formatBlockHours(flight)}</td>
      <td className="px-3 py-2.5">
        <StatusBadge status={flight.status} />
      </td>
    </tr>
  );
}

function ActualTimeCell({ actualIso }: { actualIso: string | null }) {
  if (actualIso === null) {
    return <td className="px-3 py-2.5 text-muted-foreground">—</td>;
  }
  const formatted = formatBoth(actualIso);
  return (
    <td className="px-3 py-2.5 text-status-green">
      <div className="font-mono">{formatted.local}</div>
      <div className="font-mono text-[0.6rem] opacity-80">{formatted.zulu}</div>
    </td>
  );
}

function formatBlockHours(f: FlightListItem): string {
  const dep = f.actual_departure_at ?? f.scheduled_departure_at;
  const arr = f.actual_arrival_at ?? f.scheduled_arrival_at;
  const depMs = Date.parse(dep);
  const arrMs = Date.parse(arr);
  if (!Number.isFinite(depMs) || !Number.isFinite(arrMs) || arrMs <= depMs) {
    return "—";
  }
  const hours = (arrMs - depMs) / (1000 * 60 * 60);
  const exact =
    f.actual_departure_at !== null && f.actual_arrival_at !== null;
  return `${hours.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}h${exact ? "" : "*"}`;
}

