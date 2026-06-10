import Link from "next/link";

import { AircraftFilter } from "@/components/maintenance/aircraft-filter";
import { StatusFilterTabs } from "@/components/maintenance/status-filter-tabs";
import { ApiError } from "@/lib/api/client";
import { listAircraft, listFlights } from "@/lib/api/ops";
import type { AircraftListItem, FlightListItem } from "@/lib/api/types";
import { formatBoth, formatZulu } from "@/lib/format/flight-time";

/**
 * /flight-log — pilot + dispatcher leg log (M2-G-26).
 *
 * Read-only table of completed flights. ATD / ATA + block hours
 * come from the M2-M-19 check-in actuals (lifted to the list shape
 * in M2-M-20a), so this view shows the flown picture rather than
 * the scheduled forecast.
 *
 * URL-driven state, deep-linkable:
 *   ?range=week|month|quarter|all  (default: week)
 *   ?aircraft=<aircraft-id>        (default: all)
 *
 * Range filter clamps client-side to the chosen window; aircraft
 * filter is also client-side (the existing /ops/flights endpoint
 * doesn't accept an aircraft_id query param — adding it is a tiny
 * future story when the demo fleet outgrows the tenant cap of
 * 200 rows on a single listFlights call).
 *
 * Per-flight detail (the rich 7-tab e-log from legacy
 * `templates/elog/log_page.html`) lands as M3 once we have a
 * `flight_log_entries` model. The table's flight-number cell could
 * link there in a follow-up; for now it just renders text.
 */

type Range = "week" | "month" | "quarter" | "all";
const RANGE_VALUES: Range[] = ["week", "month", "quarter", "all"];

function parseRange(raw: string | undefined): Range {
  return RANGE_VALUES.includes(raw as Range) ? (raw as Range) : "week";
}

function rangeStart(now: number, range: Range): number | null {
  const DAY = 24 * 60 * 60 * 1000;
  if (range === "week") return now - 7 * DAY;
  if (range === "month") return now - 30 * DAY;
  if (range === "quarter") return now - 90 * DAY;
  return null;  // "all"
}

const PAGE_LIMIT = 200;  // hard cap; matches the backend's max

export default async function FlightLogPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; aircraft?: string }>;
}) {
  const { range: rangeParam, aircraft: aircraftParam } = await searchParams;
  const range = parseRange(rangeParam);
  const activeAircraftId = aircraftParam ?? null;

  const now = Date.now();
  const startMs = rangeStart(now, range);

  let flights: FlightListItem[] = [];
  let aircraft: AircraftListItem[] = [];
  let loadError: string | null = null;

  try {
    const [flightsResult, aircraftResult] = await Promise.all([
      listFlights({ status: "completed", limit: PAGE_LIMIT }),
      listAircraft(),
    ]);
    flights = flightsResult.items;
    aircraft = aircraftResult.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Flight log unavailable. Try refreshing in a moment.";
  }

  // Filter to the active range + aircraft.
  const filtered = flights.filter((f) => {
    if (activeAircraftId && f.aircraft.id !== activeAircraftId) return false;
    if (startMs !== null) {
      const reference = f.actual_arrival_at ?? f.scheduled_arrival_at;
      if (Date.parse(reference) < startMs) return false;
    }
    return true;
  });

  // Sort newest-first (most recent arrival).
  filtered.sort((a, b) => {
    const aT = Date.parse(a.actual_arrival_at ?? a.scheduled_arrival_at);
    const bT = Date.parse(b.actual_arrival_at ?? b.scheduled_arrival_at);
    return bT - aT;
  });

  const totalBlockHours = filtered.reduce(
    (sum, f) => sum + (blockHoursValue(f) ?? 0),
    0,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Flight Log
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Completed flights with real ATD / ATA + flown block hours.
          Filter by date range and tail.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <StatusFilterTabs<Range>
          basePath="/flight-log"
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
          basePath="/flight-log"
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
        <EmptyState />
      ) : (
        <>
          <SummaryStrip count={filtered.length} blockHours={totalBlockHours} />
          <LogTable flights={filtered} />
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        No completed flights in this range.
      </p>
      <p className="mt-2 text-xs text-muted-foreground/70">
        Widen the range above, or check{" "}
        <Link
          href="/flight-following"
          className="text-status-blue hover:underline"
        >
          Flight Following
        </Link>{" "}
        for in-progress flights.
      </p>
    </div>
  );
}

function SummaryStrip({
  count,
  blockHours,
}: {
  count: number;
  blockHours: number;
}) {
  return (
    <div className="mb-3 flex items-center gap-3 text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
      <span>
        <span className="font-mono text-sm font-bold text-foreground">
          {count}
        </span>{" "}
        {count === 1 ? "flight" : "flights"}
      </span>
      <span className="text-muted-foreground/40">·</span>
      <span>
        <span className="font-mono text-sm font-bold text-foreground">
          {blockHours.toLocaleString("en-US", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
        </span>{" "}
        block hrs
      </span>
    </div>
  );
}

function LogTable({ flights }: { flights: FlightListItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted/30">
          <tr className="text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Flight</th>
            <th className="px-3 py-2">Aircraft</th>
            <th className="px-3 py-2">Route</th>
            <th className="px-3 py-2">ATD</th>
            <th className="px-3 py-2">ATA</th>
            <th className="px-3 py-2">Block</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f) => (
            <LogRow key={f.id} flight={f} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogRow({ flight }: { flight: FlightListItem }) {
  const dateIso =
    flight.actual_departure_at ?? flight.scheduled_departure_at;
  const date = new Date(dateIso).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  return (
    <tr className="border-t border-border hover:bg-muted/20">
      <td className="px-3 py-2.5 font-mono text-muted-foreground">
        {date}
      </td>
      <td className="px-3 py-2.5 font-semibold">
        {flight.flight_number || "—"}
      </td>
      <td className="px-3 py-2.5">
        <div className="font-mono">{flight.aircraft.tail_number}</div>
        <div className="text-[0.6rem] text-muted-foreground">
          {flight.aircraft.model}
        </div>
      </td>
      <td className="px-3 py-2.5 font-mono">
        {flight.origin}
        <span className="text-muted-foreground"> → </span>
        {flight.destination}
      </td>
      <ActualTimeCell
        actualIso={flight.actual_departure_at ?? null}
        scheduledIso={flight.scheduled_departure_at}
      />
      <ActualTimeCell
        actualIso={flight.actual_arrival_at ?? null}
        scheduledIso={flight.scheduled_arrival_at}
      />
      <td className="px-3 py-2.5 font-mono">
        {formatBlockHours(flight)}
      </td>
    </tr>
  );
}

/** ATD / ATA cell: actual time in green when set, scheduled time in
 *  muted with a small "sched" suffix when only scheduled is known. */
function ActualTimeCell({
  actualIso,
  scheduledIso,
}: {
  actualIso: string | null;
  scheduledIso: string;
}) {
  if (actualIso !== null) {
    const formatted = formatBoth(actualIso);
    return (
      <td className="px-3 py-2.5 text-status-green">
        <div className="font-mono">{formatted.local}</div>
        <div className="font-mono text-[0.6rem] opacity-80">{formatted.zulu}</div>
      </td>
    );
  }
  return (
    <td className="px-3 py-2.5 text-muted-foreground">
      <div className="font-mono">{formatZulu(scheduledIso)}</div>
      <div className="text-[0.55rem] uppercase tracking-[0.06em] opacity-70">
        sched
      </div>
    </td>
  );
}

function blockHoursValue(f: FlightListItem): number | null {
  // Real block when both actuals are set; scheduled-times proxy when
  // either is missing.
  const dep = f.actual_departure_at ?? f.scheduled_departure_at;
  const arr = f.actual_arrival_at ?? f.scheduled_arrival_at;
  const depMs = Date.parse(dep);
  const arrMs = Date.parse(arr);
  if (!Number.isFinite(depMs) || !Number.isFinite(arrMs) || arrMs <= depMs) {
    return null;
  }
  return (arrMs - depMs) / (1000 * 60 * 60);
}

function formatBlockHours(f: FlightListItem): string {
  const hours = blockHoursValue(f);
  if (hours === null) return "—";
  const suffix =
    f.actual_departure_at !== null && f.actual_arrival_at !== null ? "" : "*";
  return `${hours.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}h${suffix}`;
}
