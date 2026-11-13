import { describe, expect, it } from "vitest";

import type { FlightLeg } from "@/lib/api/types";

import { stopState } from "./stops";

const leg = (sequence: number, origin: string, destination: string, marks: Partial<FlightLeg> = {}): FlightLeg => ({
  sequence,
  origin,
  destination,
  scheduled_departure_at: "2026-11-13T18:00:00Z",
  scheduled_arrival_at: "2026-11-13T18:40:00Z",
  actual_departure_at: null,
  actual_arrival_at: null,
  ...marks,
});

const flight = (over: Record<string, unknown> = {}) => ({
  status: "released" as const,
  origin: "PABE",
  destination: "PAKN",
  actual_departure_at: null as string | null,
  actual_arrival_at: null as string | null,
  legs: [] as FlightLeg[],
  ...over,
});

const T = "2026-11-13T18:05:00Z";

describe("stopState", () => {
  it("marks a single leg as before: departed, then arrived", () => {
    expect(stopState(flight()).next).toEqual({ event: "depart", leg: null, airport: "PABE", first: true, last: true });
    const inAir = stopState(flight({ actual_departure_at: T }));
    expect([inAir.inAir, inAir.next?.event, inAir.next?.airport]).toEqual([true, "arrive", "PAKN"]);
    expect(stopState(flight({ status: "completed", actual_departure_at: T, actual_arrival_at: T })).next).toBeNull();
  });

  it("walks a multi-stop flight stop by stop", () => {
    const legs = (marks1: Partial<FlightLeg>, marks2: Partial<FlightLeg> = {}) => [
      leg(1, "PABE", "PADM", marks1),
      leg(2, "PADM", "PAKN", marks2),
    ];
    expect(stopState(flight({ legs: legs({}) }))).toEqual({
      inAir: false,
      atStop: null,
      next: { event: "depart", leg: 1, airport: "PABE", first: true, last: false },
    });
    expect(stopState(flight({ actual_departure_at: T, legs: legs({ actual_departure_at: T }) }))).toEqual({
      inAir: true,
      atStop: null,
      next: { event: "arrive", leg: 1, airport: "PADM", first: false, last: false },
    });
    const landed = { actual_departure_at: T, actual_arrival_at: T };
    expect(stopState(flight({ actual_departure_at: T, legs: legs(landed) }))).toEqual({
      inAir: false,
      atStop: "PADM",
      next: { event: "depart", leg: 2, airport: "PADM", first: false, last: false },
    });
    expect(stopState(flight({ actual_departure_at: T, legs: legs(landed, { actual_departure_at: T }) })).next).toEqual(
      { event: "arrive", leg: 2, airport: "PAKN", first: false, last: true },
    );
  });

  it("takes a flight that left before its stops were marked as flying its first leg", () => {
    const state = stopState(flight({ actual_departure_at: T, legs: [leg(1, "PABE", "PADM"), leg(2, "PADM", "PAKN")] }));
    expect([state.inAir, state.next?.event, state.next?.leg, state.next?.airport]).toEqual([true, "arrive", 1, "PADM"]);
  });

  it("has nothing to mark on a flight not released", () => {
    expect(stopState(flight({ status: "scheduled", legs: [leg(1, "PABE", "PADM"), leg(2, "PADM", "PAKN")] }))).toEqual({
      next: null,
      inAir: false,
      atStop: null,
    });
  });
});
