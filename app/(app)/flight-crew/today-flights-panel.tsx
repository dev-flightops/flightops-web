import Link from "next/link";

import { buttonOutline, linkCaps } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import { FlightCategoryBadge } from "@/components/weather/flight-category-badge";
import type { FlightListItem, WeatherReportResponse } from "@/lib/api/types";
import type { FlightReady } from "@/lib/flights/next-flight";
import { DEFAULT_ZONE_TABLE, localClock, localDate, zoneFor, type ZoneTable } from "@/lib/format/local-time";
import { flightStops, routeText } from "@/lib/route";
import { cn } from "@/lib/utils";
import { fieldFormat, observedLabel, utcHm } from "@/lib/weather-format";

import { Readiness } from "./preflight/[flightId]/readiness";

interface Props {
  flights: FlightListItem[];
  /** The company's base zones, for each flight's local times (#68). */
  zones?: ZoneTable | null;
  /** The current METAR at each stop, by ICAO (20 Nov). */
  weather?: Record<string, WeatherReportResponse>;
  /** Each flight's fuel, load and passengers, by flight id (20 Nov). */
  ready?: Record<string, FlightReady>;
}

/**
 * "My Flights" panel (Spec 4 §"Page layout / My Flights today").
 *
 * One row per flight (#81: rows in the page's My Flights panel, not
 * cards): flight number, route, aircraft, the date and scheduled times,
 * status mark, Begin Preflight.
 *
 * The next flight, read from the air (20 Nov). The client: "when we are
 * on our way back from base, the next flight is usually already generated
 * for us ... What would be critical for planning from both pilot/dispatch
 * is the ability to see routing/current weather (winds/ceiling/vis), so
 * that I can order fuel while I'm still in the air." So each row carries
 * the current METAR at every stop, what's ready (fuel, load, passengers)
 * and Order fuel, which opens the preflight at its fuel.
 *
 * WHY EVERY ROW CARRIES A DATE, AND WHY NOTHING SAYS "TODAY"
 *
 * The page used to ask the server for one UTC day and call it today,
 * which hid a pilot's evening flight in Alaska (16:00 there is already
 * tomorrow in UTC). The page now fetches a three-UTC-day window and this
 * panel does no calendar arithmetic: it lists what it was given, in time
 * order, each with its date. The date and times are the departure base's
 * (#68), formatted in that named zone, so the server and the browser
 * render the same thing; the Zulu times stay beside them.
 */
export function TodayFlightsPanel({ flights, zones, weather, ready }: Props) {
  if (flights.length === 0) {
    // This used to mean "no flights in the tenant today", because the
    // panel showed all of them. It now means "dispatch has not rostered
    // you onto anything", which is a different thing and worth saying
    // out loud: a pilot who expects to be flying should ring dispatch
    // rather than assume the page is broken.
    return (
      <EmptyState>
        You&apos;re not rostered on any flights just now.{" "}
        <span className="block pt-1 text-xs">
          If you&apos;re expecting to fly, check with dispatch — or{" "}
          <Link
            href="/flight-crew/elog"
            className="font-semibold text-primary hover:underline"
          >
            create a manual log
          </Link>{" "}
          for off-schedule flying.
        </span>
      </EmptyState>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {flights.map((f) => (
        <FlightCard
          key={f.id}
          flight={f}
          timeZone={zoneFor(zones ?? DEFAULT_ZONE_TABLE, f.origin)}
          weather={weather}
          ready={ready?.[f.id]}
        />
      ))}
    </ul>
  );
}

function FlightCard({
  flight,
  timeZone,
  weather,
  ready,
}: {
  flight: FlightListItem;
  timeZone: string;
  weather?: Record<string, WeatherReportResponse>;
  ready?: FlightReady;
}) {
  const departs = flight.scheduled_departure_at;
  const arrives = flight.scheduled_arrival_at;
  return (
    <li className="px-5 py-4 transition-colors hover:bg-accent/40">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold text-foreground">
              {flight.flight_number}
            </span>
            <StatusBadge status={flight.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">
              {routeText(flight)}
            </span>
            <span className="text-xs">
              {flight.aircraft.tail_number}
              {flight.aircraft.model ? (
                <span className="text-muted-foreground">
                  {" · "}
                  {flight.aircraft.model}
                </span>
              ) : null}
            </span>
          </div>
          <div className="mt-1 text-[0.7rem] text-muted-foreground">
            {/* The date is not decoration. Without it a pilot looking
                at two rows cannot tell which one is tonight. */}
            <span className="font-semibold text-foreground/80">{localDate(departs, timeZone)}</span>
            {` · ETD ${localClock(departs, timeZone)} · ETA ${localClock(arrives, timeZone)}`}
            <span className="ml-2 font-mono">{`${utcHm(departs)}–${utcHm(arrives)}`}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Link
            href={`/flight-crew/preflight/${flight.id}`}
            className={cn(buttonOutline, "px-3 py-1.5")}
          >
            Begin Preflight →
          </Link>
          {/* From the air (20 Nov): the preflight opens at its fuel. */}
          <Link href={`/flight-crew/preflight/${flight.id}#preflight-fuel-heading`} className={linkCaps}>
            Order fuel ›
          </Link>
          {/* The flight's FRAT, filed and signed before the release (#155):
              "opened right from that flight on ... the pilot's schedule". */}
          <Link href={`/frat/${flight.id}`} className={linkCaps}>
            FRAT ›
          </Link>
        </div>
      </div>
      {weather ? <StopsWeather stops={flightStops(flight)} weather={weather} /> : null}
      {ready ? (
        <Readiness
          compact
          fuelOrders={ready.fuelOrders}
          assignment={ready.assignment}
          flightLoad={ready.flightLoad}
          timeZone={timeZone}
        />
      ) : null}
    </li>
  );
}

/** Each stop once, with its current METAR: the category, wind,
 *  visibility and ceiling, and when it was observed. */
function StopsWeather({ stops, weather }: { stops: string[]; weather: Record<string, WeatherReportResponse> }) {
  const unique = [...new Set(stops.map((s) => s.toUpperCase()))];
  return (
    <section aria-label="Weather now" className="mt-3">
      <p className="eyebrow mb-1">Weather now</p>
      <ul className="space-y-1 text-xs">
        {unique.map((icao) => {
          const r = weather[icao];
          const seen = r ? observedLabel(r) : null;
          return (
            <li key={icao} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="w-10 font-mono font-semibold text-foreground">{icao}</span>
              {r ? (
                <>
                  {r.flight_category ? <FlightCategoryBadge category={r.flight_category} /> : null}
                  <span className="text-foreground">
                    {`${fieldFormat.wind(r)} · ${fieldFormat.visibility(r)} · ${fieldFormat.ceiling(r)}`}
                  </span>
                  {seen ? <span className="text-muted-foreground">{seen}</span> : null}
                </>
              ) : (
                <span className="text-muted-foreground">No current METAR</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone: StatusTone =
    status === "released"
      ? "blue"
      : status === "scheduled"
        ? "yellow"
        : status === "cancelled"
          ? "red"
          : "muted";
  const label =
    status === "released"
      ? "Released"
      : status === "scheduled"
        ? "Scheduled"
        : status.charAt(0).toUpperCase() + status.slice(1);
  return <StatusMark label={label} tone={tone} />;
}
