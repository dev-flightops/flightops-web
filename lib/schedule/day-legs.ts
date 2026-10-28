import type { FlightListItem } from "@/lib/api/types";
import { utcToLocalInput } from "@/lib/format/local-time";

/**
 * The schedule by aircraft (#139): every leg of the day's flights, in a
 * column for its aircraft, placed down the day at its local times.
 *
 * The client's own scheduling system shows the day this way, one column
 * per N-number and a block per leg, and opens a flight from its block.
 */

/** A leg's state on the schedule: its flight's, with "airborne" between
 *  the flight's actual departure and arrival. */
export type LegState = "planned" | "released" | "airborne" | "completed" | "cancelled";

export interface DayLeg {
  flightId: string;
  flightNumber: string;
  /** 1-based, in flying order. */
  index: number;
  legCount: number;
  /** "PGR790.1" for a leg of a multi-leg flight, else the flight number. */
  label: string;
  /** Every airport on the flight's route, in order. */
  stops: string[];
  origin: string;
  destination: string;
  departsAt: string;
  arrivesAt: string;
  state: LegState;
  aircraftId: string;
  tail: string;
  /** Seats on the aircraft; null when not recorded. */
  seats: number | null;
  /** Seats held on this leg, when the day's list carried them. */
  held: number | null;
}

export function legState(flight: FlightListItem): LegState {
  if (flight.status === "cancelled") return "cancelled";
  if (flight.status === "completed" || flight.actual_arrival_at) return "completed";
  if (flight.actual_departure_at) return "airborne";
  return flight.status === "released" ? "released" : "planned";
}

export function dayLegs(flights: FlightListItem[]): DayLeg[] {
  return flights.flatMap((flight) => {
    const legs =
      flight.legs && flight.legs.length > 0
        ? [...flight.legs].sort((a, b) => a.sequence - b.sequence)
        : [
            {
              sequence: 1,
              origin: flight.origin,
              destination: flight.destination,
              scheduled_departure_at: flight.scheduled_departure_at,
              scheduled_arrival_at: flight.scheduled_arrival_at,
            },
          ];
    const state = legState(flight);
    return legs.map((leg, i) => ({
      flightId: flight.id,
      flightNumber: flight.flight_number,
      index: i + 1,
      legCount: legs.length,
      label: legs.length > 1 ? `${flight.flight_number}.${i + 1}` : flight.flight_number,
      stops: [legs[0].origin, ...legs.map((l) => l.destination)],
      origin: leg.origin,
      destination: leg.destination,
      departsAt: leg.scheduled_departure_at,
      arrivesAt: leg.scheduled_arrival_at,
      state,
      aircraftId: flight.aircraft.id,
      tail: flight.aircraft.tail_number,
      seats: flight.aircraft.seats ?? null,
      held: flight.seats_held_by_leg?.[i] ?? null,
    }));
  });
}

/** An aircraft the schedule can show, from the fleet's airworthiness. */
export interface FleetEntry {
  id: string;
  tail: string;
  model: string | null;
  active: boolean;
  airworthy: boolean;
  groundedReason: string | null;
}

const GROUNDED: Record<string, string> = {
  mel_expired: "MEL expired",
  manual: "Grounded by maintenance",
  fuel_hold: "Fuel hold",
};

/** Why an aircraft can't fly, in words; null when it can. */
export function groundedLabel(entry: FleetEntry): string | null {
  if (entry.groundedReason) {
    return GROUNDED[entry.groundedReason] ?? entry.groundedReason.replace(/_/g, " ");
  }
  if (entry.active && !entry.airworthy) return "Not airworthy";
  return null;
}

export interface AircraftColumn {
  id: string;
  tail: string;
  model: string | null;
  /** Why it can't fly, when it can't. */
  grounded: string | null;
  legs: DayLeg[];
}

/**
 * One column per aircraft that can fly, is grounded, or has a leg that
 * day, by tail number. An inactive aircraft with no reason and no legs
 * (sold, stored) has no column.
 */
export function aircraftColumns(fleet: FleetEntry[], legs: DayLeg[]): AircraftColumn[] {
  const columns = new Map<string, AircraftColumn>();
  for (const entry of fleet) {
    const grounded = groundedLabel(entry);
    if (!entry.active && !grounded) continue;
    columns.set(entry.id, { id: entry.id, tail: entry.tail, model: entry.model, grounded, legs: [] });
  }
  for (const leg of legs) {
    let column = columns.get(leg.aircraftId);
    if (!column) {
      column = { id: leg.aircraftId, tail: leg.tail, model: null, grounded: null, legs: [] };
      columns.set(leg.aircraftId, column);
    }
    column.legs.push(leg);
  }
  for (const column of columns.values()) {
    column.legs.sort((a, b) => Date.parse(a.departsAt) - Date.parse(b.departsAt));
  }
  return [...columns.values()].sort((a, b) => a.tail.localeCompare(b.tail));
}

/** Minutes from local midnight of `day` (YYYY-MM-DD) in `zone`; negative
 *  the day before, past 1440 the day after. */
export function minutesInto(day: string, iso: string, zone: string): number {
  const local = utcToLocalInput(iso, zone); // YYYY-MM-DDTHH:MM
  const days = Math.round((Date.parse(`${local.slice(0, 10)}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);
  return days * 1440 + Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
}

/** The hours the grid shows: 06:00 to 20:00, widened to every leg. */
export function hourWindow(day: string, legs: DayLeg[], zone: string): { start: number; end: number } {
  let start = 6;
  let end = 20;
  for (const leg of legs) {
    start = Math.min(start, Math.floor(minutesInto(day, leg.departsAt, zone) / 60));
    end = Math.max(end, Math.ceil(minutesInto(day, leg.arrivesAt, zone) / 60));
  }
  return { start: Math.max(0, start), end: Math.min(24, Math.max(end, start + 1)) };
}

export interface PlacedLeg extends DayLeg {
  /** Minutes from the top of the grid. */
  top: number;
  /** Minutes long, at least 20 so a short hop can be read and clicked. */
  height: number;
  /** Side by side when legs overlap on one aircraft. */
  lane: number;
  lanes: number;
}

export const MIN_BLOCK_MINUTES = 20;

/** A column's legs placed from the grid's first hour, overlaps in lanes. */
export function placeLegs(day: string, legs: DayLeg[], zone: string, startHour: number): PlacedLeg[] {
  const placed: PlacedLeg[] = legs
    .map((leg) => {
      const top = minutesInto(day, leg.departsAt, zone) - startHour * 60;
      const length = minutesInto(day, leg.arrivesAt, zone) - startHour * 60 - top;
      return { ...leg, top, height: Math.max(length, MIN_BLOCK_MINUTES), lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.top - b.top);
  let cluster: PlacedLeg[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    const lanes = Math.max(1, ...cluster.map((p) => p.lane + 1));
    for (const p of cluster) p.lanes = lanes;
    cluster = [];
  };
  for (const leg of placed) {
    if (leg.top >= clusterEnd) close();
    const ends = cluster.map((p) => ({ lane: p.lane, end: p.top + p.height }));
    let lane = 0;
    while (ends.some((e) => e.lane === lane && e.end > leg.top)) lane += 1;
    leg.lane = lane;
    cluster.push(leg);
    clusterEnd = Math.max(clusterEnd, leg.top + leg.height);
  }
  close();
  return placed;
}
