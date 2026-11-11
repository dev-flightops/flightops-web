import type { FlightAssignmentResponse } from "@/lib/api/types";

/**
 * The ramp timer (LOG-43, 10/24: "Is there a ramp timer? ... a clear
 * workflow ... to track load build out and when the plane is loaded"):
 * a flight's load timed against its scheduled departure.
 */

const MINUTE = 60_000;

function minutes(ms: number): number {
  return Math.round(ms / MINUTE);
}

function span(min: number): string {
  const m = Math.abs(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** "departs in 25 min", "departure was 5 min ago", "departs now". */
function untilDeparture(departsAt: number, now: number): string {
  const min = minutes(departsAt - now);
  if (min === 0) return "departs now";
  return min > 0 ? `departs in ${span(min)}` : `departure was ${span(min)} ago`;
}

/** "10 min before departure", "5 min after the scheduled departure", "at departure". */
function againstDeparture(at: number, departsAt: number): string {
  const min = minutes(departsAt - at);
  if (min === 0) return "at departure";
  return min > 0 ? `${span(min)} before departure` : `${span(min)} after the scheduled departure`;
}

export interface LoadTiming {
  text: string;
  /** Loaded after the scheduled departure, or still loading past it. */
  late: boolean;
}

export function loadTiming(
  a: Pick<FlightAssignmentResponse, "load_started_at" | "load_completed_at"> & {
    flight: Pick<FlightAssignmentResponse["flight"], "scheduled_departure_at">;
  },
  now: number,
): LoadTiming {
  const departs = Date.parse(a.flight.scheduled_departure_at);
  const started = a.load_started_at ? Date.parse(a.load_started_at) : null;
  const done = a.load_completed_at ? Date.parse(a.load_completed_at) : null;
  if (done !== null) {
    const took = started !== null && started <= done ? `in ${span(minutes(done - started))}, ` : "";
    return { text: `Loaded ${took}${againstDeparture(done, departs)}`, late: done > departs + MINUTE / 2 };
  }
  if (started !== null) {
    return {
      text: `Loading ${span(minutes(now - started))}, ${untilDeparture(departs, now)}`,
      late: now > departs,
    };
  }
  return { text: `Not started, ${untilDeparture(departs, now)}`, late: now > departs };
}
