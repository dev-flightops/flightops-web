import Link from "next/link";

import { buttonOutline, buttonSolid, linkCaps, segment, segmentGroup } from "@/components/ff/controls";
import { PageHeader } from "@/components/ff/page-header";
import { LoadFailedNotice } from "@/components/ff/setup-notice";
import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Loads } from "@/lib/api/loads";
import { getFleetAirworthiness } from "@/lib/api/maintenance";
import { listAircraft, listFlights } from "@/lib/api/ops";
import type {
  FlightListItem,
  FlightStatus,
} from "@/lib/api/types";
import { localClock, localDate, localDay, type ZoneTable, zoneFor } from "@/lib/format/local-time";
import { routeText } from "@/lib/route";
import {
  aircraftColumns,
  dayLegs,
  type FleetEntry,
  hourWindow,
  legState,
  minutesInto,
  placeLegs,
} from "@/lib/schedule/day-legs";

import { AircraftDay, type DayColumn } from "./aircraft-day";
import { DatePicker } from "./date-picker";
import { FlightPanelButton } from "./flight-panel";
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
 *   ?view=list                (default: by aircraft, #139)
 *
 * By aircraft (#139), the day is a column per aircraft and a block per
 * leg, as the client's own scheduling system shows it; a block opens the
 * flight's panel on that leg. The list groups flights by base.
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
  searchParams: Promise<{ date?: string; statuses?: string; view?: string }>;
}) {
  const { date: dateParam, statuses: statusesParam, view: viewParam } = await searchParams;
  const view = viewParam === "list" ? "list" : "aircraft";
  const zones = await loadZoneTable();
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : localDay(zones.fallback); // the company's day, not UTC's (#137)
  const statuses = parseStatuses(statusesParam);

  let flights: FlightListItem[] = [];
  let loadError: string | null = null;

  try {
    flights = (await listFlights({ onCompanyDate: date, limit: 200, withSeats: view === "aircraft" })).items;
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
  const byAircraft = view === "aircraft" && !loadError ? await aircraftDay(date, filtered, zones.fallback) : null;
  const viewHref = (v: "aircraft" | "list") => {
    const params = new URLSearchParams({ date });
    if (statusesParam) params.set("statuses", statusesParam);
    if (v === "list") params.set("view", "list");
    return `/schedule?${params.toString()}`;
  };

  return (
    <div className={`mx-auto px-4 py-8 sm:px-6 ${view === "aircraft" ? "max-w-[100rem]" : "max-w-6xl"}`}>
      <PageHeader
        title="Flight Schedule"
        description={`Published schedule for ${localDate(`${date}T12:00:00Z`, "UTC", { withYear: true })} — ${totalCount} flight${totalCount === 1 ? "" : "s"}. Open a flight for its bookings and manifest.`}
        actions={
          <>
            <nav aria-label="View" className={segmentGroup}>
              <Link href={viewHref("aircraft")} aria-current={view === "aircraft" ? "page" : undefined} className={segment(view === "aircraft")}>
                By aircraft
              </Link>
              <Link href={viewHref("list")} aria-current={view === "list" ? "page" : undefined} className={segment(view === "list")}>
                List
              </Link>
            </nav>
            <DatePicker defaultValue={date} statuses={statusesParam ?? ""} view={view} />
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

      <StatusFilter date={date} statuses={statuses} view={view} />

      {byAircraft ? (
        <>
          <LoadFailedNotice what={byAircraft.failed} meaning="Aircraft with no flight that day may be missing." className="mb-4" />
          {totalCount === 0 ? (
            <p className="mb-3 text-sm text-muted-foreground">
              {flights.length === 0 ? `No flights scheduled for ${date}.` : "No flights match the current status filter."}
            </p>
          ) : null}
          <AircraftDay
            columns={byAircraft.columns}
            start={byAircraft.start}
            end={byAircraft.end}
            zone={zones.fallback}
            zones={zones}
            nowMinute={date === localDay(zones.fallback) ? minutesInto(date, new Date().toISOString(), zones.fallback) : null}
          />
        </>
      ) : loadError ? (
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

/**
 * The day's legs by aircraft (#139). The fleet is ops' aircraft, with
 * maintenance's word on which are grounded and why where the viewer may
 * read it; a reservations agent may not, and then sees no reason.
 */
async function aircraftDay(
  date: string,
  flights: FlightListItem[],
  zone: string,
): Promise<{ columns: DayColumn[]; start: number; end: number; failed: string[] }> {
  const loads = new Loads();
  const [aircraft, fleet] = await Promise.all([
    loads.or(listAircraft(), null, "the fleet"),
    loads.or(getFleetAirworthiness(), null, "which aircraft are grounded"),
  ]);
  const status = new Map((fleet?.items ?? []).map((f) => [f.aircraft.id, f]));
  const entries: FleetEntry[] = (aircraft?.items ?? []).map((a) => {
    const s = status.get(a.id);
    return {
      id: a.id,
      tail: a.tail_number,
      model: a.model,
      active: a.is_active,
      airworthy: s ? s.is_airworthy : true,
      groundedReason: s?.grounded_reason ?? null,
    };
  });
  const legs = dayLegs(flights);
  const { start, end } = hourWindow(date, legs, zone);
  const columns = aircraftColumns(entries, legs).map((c) => ({ ...c, legs: placeLegs(date, c.legs, zone, start) }));
  return { columns, start, end, failed: loads.failed };
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
        <FlightPanelButton
          flight={{
            id: flight.id,
            flightNumber: flight.flight_number,
            stops,
            tail: flight.aircraft.tail_number,
            state: legState(flight),
          }}
          zones={zones}
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
