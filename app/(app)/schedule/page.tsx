import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listFlights } from "@/lib/api/ops";
import type {
  FlightListItem,
  FlightStatus,
} from "@/lib/api/types";

import { DatePicker } from "./date-picker";
import { StatusFilter } from "./status-filter";

/**
 * /schedule — Published flight schedule (M2-G-30).
 *
 * Pure read view of the day's flights, designed for review and
 * printing the per-flight manifest / release sheet. Distinct from
 * /flight-following which is the live tracking surface.
 *
 * URL-driven state:
 *   ?date=YYYY-MM-DD          (default: today UTC)
 *   ?statuses=scheduled,released  (default: all)
 *
 * Flights group by origin ICAO (each base gets its own panel), sorted
 * within each group by scheduled_departure_at ascending. Each row
 * gets a "Manifest" link to the printable release sheet.
 */

const ALLOWED_STATUSES: ReadonlySet<FlightStatus> = new Set([
  "scheduled",
  "released",
  "cancelled",
  "completed",
]);

const STATUS_LABEL: Record<FlightStatus, string> = {
  scheduled: "Planned",
  released: "Released",
  cancelled: "Cancelled",
  completed: "Completed",
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseStatuses(raw: string | undefined): FlightStatus[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase() as FlightStatus)
        .filter((s) => ALLOWED_STATUSES.has(s)),
    ),
  ];
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; statuses?: string }>;
}) {
  const { date: dateParam, statuses: statusesParam } = await searchParams;
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : todayUtc();
  const statuses = parseStatuses(statusesParam);

  let flights: FlightListItem[] = [];
  let loadError: string | null = null;

  try {
    flights = (await listFlights({ onDate: date, limit: 200 })).items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Schedule feed unavailable. Try refreshing in a moment.";
  }

  const filtered =
    statuses.length === 0
      ? flights
      : flights.filter((f) => statuses.includes(f.status));

  const grouped = groupByOrigin(filtered);
  const totalCount = filtered.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Flight Schedule
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Published schedule for {date} (UTC) — {totalCount} flight
            {totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker defaultValue={date} statuses={statusesParam ?? ""} />
          <Link
            href="/flight-following"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40"
            title="Switch to live tracking view"
          >
            Live →
          </Link>
        </div>
      </header>

      <StatusFilter date={date} statuses={statuses} />

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : totalCount === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {flights.length === 0
              ? `No flights scheduled for ${date}.`
              : "No flights match the current status filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([base, list]) => (
            <BaseGroup key={base} base={base} flights={list} />
          ))}
        </div>
      )}
    </div>
  );
}

function groupByOrigin(
  flights: FlightListItem[],
): Record<string, FlightListItem[]> {
  const out: Record<string, FlightListItem[]> = {};
  for (const f of flights) {
    const key = f.origin || "Unassigned";
    if (!out[key]) out[key] = [];
    out[key].push(f);
  }
  for (const key of Object.keys(out)) {
    out[key].sort(
      (a, b) =>
        new Date(a.scheduled_departure_at).getTime() -
        new Date(b.scheduled_departure_at).getTime(),
    );
  }
  return out;
}

function BaseGroup({
  base,
  flights,
}: {
  base: string;
  flights: FlightListItem[];
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-baseline gap-3 text-sm font-semibold tracking-wide">
        <span className="font-mono text-foreground">{base}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {flights.length} flight{flights.length === 1 ? "" : "s"} from this
          base
        </span>
      </h2>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/40 text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <th className="px-4 py-3">Flight</th>
              <th className="px-4 py-3">Route</th>
              <th className="px-4 py-3">Aircraft</th>
              <th className="px-4 py-3">ETD</th>
              <th className="px-4 py-3">ETA</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Manifest</th>
            </tr>
          </thead>
          <tbody>
            {flights.map((f) => (
              <FlightRow key={f.id} flight={f} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FlightRow({ flight }: { flight: FlightListItem }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3 font-semibold text-foreground">
        {flight.flight_number}
      </td>
      <td className="px-4 py-3 font-mono text-foreground">
        {flight.origin}{" "}
        <span className="text-muted-foreground">→</span> {flight.destination}
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-foreground">
          {flight.aircraft.tail_number}
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          {flight.aircraft.model}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-foreground">
        {formatHm(flight.scheduled_departure_at)}
        {flight.actual_departure_at && (
          <span className="ml-1.5 text-status-green">
            (ATD {formatHm(flight.actual_departure_at)})
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-foreground">
        {formatHm(flight.scheduled_arrival_at)}
        {flight.actual_arrival_at && (
          <span className="ml-1.5 text-status-green">
            (ATA {formatHm(flight.actual_arrival_at)})
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={flight.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/schedule/${flight.id}/manifest`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-status-blue/40 bg-status-blue/10 px-2.5 py-1 text-xs font-semibold text-status-blue hover:bg-status-blue/20"
        >
          🖨 Print
        </Link>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: FlightStatus }) {
  const tone: Record<FlightStatus, string> = {
    scheduled: "border-border bg-card text-muted-foreground",
    released: "border-status-blue/40 bg-status-blue/10 text-status-blue",
    cancelled: "border-status-red/40 bg-status-red/10 text-status-red",
    completed: "border-status-green/40 bg-status-green/10 text-status-green",
  };
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] ${tone[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function formatHm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}Z`;
}
