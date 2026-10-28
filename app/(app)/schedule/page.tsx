import Link from "next/link";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import { PageHeader } from "@/components/ff/page-header";
import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { listFlights } from "@/lib/api/ops";
import type {
  FlightListItem,
  FlightStatus,
} from "@/lib/api/types";
import { localClock, localDate, utcToLocalInput, type ZoneTable, zoneFor } from "@/lib/format/local-time";
import { routeText } from "@/lib/route";

import { DatePicker } from "./date-picker";
import { FlightPanel } from "./flight-panel";
import { StatusFilter } from "./status-filter";

/**
 * /schedule — Published flight schedule (M2-G-30).
 *
 * Pure read view of the day's flights, designed for review and
 * printing the per-flight manifest / release sheet. Distinct from
 * /flight-following which is the live tracking surface.
 *
 * URL-driven state:
 *   ?date=YYYY-MM-DD          (default: today, the company's day, #137)
 *   ?statuses=scheduled,released  (default: all)
 *
 * Flights group by origin ICAO (each base gets its own panel), sorted
 * within each group by scheduled_departure_at ascending. A flight's
 * number opens its panel: seats, bookings, Add booking, the manifest
 * (#137). Its row links the manifest to build and the sheet to print.
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

/** Today in the company's zone (#137): a UTC day started tomorrow's
 *  schedule at 4 pm Alaska time. */
function today(zone: string): string {
  return utcToLocalInput(new Date().toISOString(), zone).slice(0, 10);
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
  const zones = await loadZoneTable();
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : today(zones.fallback);
  const statuses = parseStatuses(statusesParam);

  let flights: FlightListItem[] = [];
  let loadError: string | null = null;

  try {
    flights = (await listFlights({ onCompanyDate: date, limit: 200 })).items;
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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Flight Schedule"
        description={`Published schedule for ${localDate(`${date}T12:00:00Z`, "UTC", { withYear: true })} — ${totalCount} flight${totalCount === 1 ? "" : "s"}. Open a flight for its bookings and manifest.`}
        actions={
          <>
            <DatePicker defaultValue={date} statuses={statusesParam ?? ""} />
            {/* The form lives under Flight Following and is called "Open
                Flight", which is where nobody looks for it: the client
                reported being "mostly unsuccessful in building flight"
                on 9/9. The schedule is the page you are on when you
                notice a flight is missing, so the way to add one belongs
                here. One form still, linked from where the need arises. */}
            <Link href="/flight-following/new" className={buttonSolid}>
              + New Flight
            </Link>
            <Link href="/flight-following" className={buttonOutline} title="Switch to live tracking view">
              Live →
            </Link>
          </>
        }
      />

      <StatusFilter date={date} statuses={statuses} />

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : totalCount === 0 ? (
        <div className="rounded-lg border border-border bg-card px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {flights.length === 0
              ? `No flights scheduled for ${date}.`
              : "No flights match the current status filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([base, list]) => (
            <BaseGroup key={base} base={base} flights={list} zones={zones} />
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
  zones,
}: {
  base: string;
  flights: FlightListItem[];
  zones: ZoneTable;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-baseline gap-3">
        <span className="font-mono text-sm font-semibold text-foreground">{base}</span>
        <span className="eyebrow">
          {flights.length} flight{flights.length === 1 ? "" : "s"} from this
          base
        </span>
      </h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="ff-thead">
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
              <FlightRow key={f.id} flight={f} zones={zones} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FlightRow({ flight, zones }: { flight: FlightListItem; zones: ZoneTable }) {
  const zone = zoneFor(zones, flight.origin);
  const stops = flight.stops && flight.stops.length > 0 ? flight.stops : [flight.origin, flight.destination];
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">
        <FlightPanel
          flight={{
            id: flight.id,
            flightNumber: flight.flight_number,
            stops,
            departs: `${localDate(flight.scheduled_departure_at, zone)}, ${localClock(flight.scheduled_departure_at, zone)}`,
            departsLocal: utcToLocalInput(flight.scheduled_departure_at, zone),
            tail: flight.aircraft.tail_number,
          }}
        />
      </td>
      <td className="px-4 py-3 font-mono text-foreground">
        {/* #137: every stop; a round trip read PABE → PABE. */}
        {routeText(flight)}
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
        {localClock(flight.scheduled_departure_at, zone)}
        <span className="ml-1.5 text-muted-foreground">{formatHm(flight.scheduled_departure_at)}</span>
        {flight.actual_departure_at && (
          <span className="ml-1.5 text-status-green">
            (ATD {formatHm(flight.actual_departure_at)})
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-foreground">
        {localClock(flight.scheduled_arrival_at, zone)}
        <span className="ml-1.5 text-muted-foreground">{formatHm(flight.scheduled_arrival_at)}</span>
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
        {/* #137: the manifest to build, not only the sheet to print. */}
        <Link href={`/manifest/${flight.id}`} className={`mr-4 ${linkCaps}`}>
          Open <span aria-hidden>›</span>
        </Link>
        <Link
          href={`/schedule/${flight.id}/manifest`}
          target="_blank"
          rel="noopener noreferrer"
          className={linkCaps}
        >
          Print <span aria-hidden>›</span>
        </Link>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: FlightStatus }) {
  const tone: Record<FlightStatus, StatusTone> = {
    scheduled: "muted",
    released: "blue",
    cancelled: "red",
    completed: "green",
  };
  return <StatusMark label={STATUS_LABEL[status]} tone={tone[status]} />;
}

function formatHm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}Z`;
}
