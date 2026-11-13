import type { BoardFlightItem, FlightLeg } from "@/lib/api/types";

/**
 * Where a released flight stands by Flight Following's marks, and what to
 * mark next (bug doc LOG-14; Greg, 13 Nov: "mark those"). A multi-stop
 * flight is marked at each stop, leg by leg, as the ops service takes
 * them: a departure on the first leg not yet left, once the leg before it
 * has landed; an arrival on the leg in the air. A single-leg flight is
 * marked as before.
 */

export interface NextMark {
  event: "depart" | "arrive";
  /** The leg it's for, on a multi-stop flight; null for a single leg. */
  leg: number | null;
  /** Where: the airport it leaves or lands at. */
  airport: string;
  /** Its departure from where it started: the flight's own, flagged (#155). */
  first: boolean;
  /** Its landing at its destination: the flight completes. */
  last: boolean;
}

export interface StopState {
  next: NextMark | null;
  /** In the air between two marks. */
  inAir: boolean;
  /** On the ground at a stop on its way, between legs. */
  atStop: string | null;
}

type Marked = Pick<
  BoardFlightItem,
  "status" | "origin" | "destination" | "actual_departure_at" | "actual_arrival_at" | "legs"
>;

export function stopState(flight: Marked): StopState {
  const none: StopState = { next: null, inAir: false, atStop: null };
  if (flight.status !== "released") return none;
  const legs = [...(flight.legs ?? [])].sort((a, b) => a.sequence - b.sequence);
  if (legs.length === 0) {
    if (flight.actual_departure_at === null) {
      return { ...none, next: { event: "depart", leg: null, airport: flight.origin, first: true, last: true } };
    }
    if (flight.actual_arrival_at === null) {
      return {
        ...none,
        inAir: true,
        next: { event: "arrive", leg: null, airport: flight.destination, first: true, last: true },
      };
    }
    return none;
  }
  // A flight that left before its stops were marked left on its first leg.
  const left = (leg: FlightLeg, i: number) =>
    leg.actual_departure_at ?? (i === 0 ? flight.actual_departure_at : null) ?? null;
  const flying = legs.findIndex((leg, i) => left(leg, i) !== null && !leg.actual_arrival_at);
  if (flying >= 0) {
    const leg = legs[flying];
    return {
      ...none,
      inAir: true,
      next: { event: "arrive", leg: leg.sequence, airport: leg.destination, first: false, last: flying === legs.length - 1 },
    };
  }
  const waiting = legs.findIndex((leg, i) => left(leg, i) === null);
  if (waiting < 0) return none;
  const leg = legs[waiting];
  return {
    ...none,
    atStop: waiting > 0 ? leg.origin : null,
    next: { event: "depart", leg: leg.sequence, airport: leg.origin, first: waiting === 0, last: false },
  };
}
