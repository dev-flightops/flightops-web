import { describe, expect, it } from "vitest";

import type { FlightListItem } from "@/lib/api/types";

import {
  aircraftColumns,
  dayLegs,
  type FleetEntry,
  groundedLabel,
  hourWindow,
  legState,
  minutesInto,
  placeLegs,
} from "./day-legs";

const AK = "America/Anchorage";

function flight(overrides: Partial<FlightListItem>): FlightListItem {
  return {
    id: "f-1",
    flight_number: "PGR790",
    origin: "PABE",
    destination: "PABE",
    scheduled_departure_at: "2026-10-30T18:30:00Z",
    scheduled_arrival_at: "2026-10-30T21:15:00Z",
    status: "scheduled",
    aircraft: { id: "ac-100", tail_number: "N100PA", model: "Cessna 208 Caravan", seats: 9 },
    actual_departure_at: null,
    actual_arrival_at: null,
    stops: ["PABE", "9Z8", "PABE"],
    legs: [
      { sequence: 2, origin: "9Z8", destination: "PABE", scheduled_departure_at: "2026-10-30T20:00:00Z", scheduled_arrival_at: "2026-10-30T21:15:00Z" },
      { sequence: 1, origin: "PABE", destination: "9Z8", scheduled_departure_at: "2026-10-30T18:30:00Z", scheduled_arrival_at: "2026-10-30T19:45:00Z" },
    ],
    seats_held_by_leg: [5, 0],
    ...overrides,
  };
}

const entry = (overrides: Partial<FleetEntry>): FleetEntry => ({
  id: "ac-x",
  tail: "N000PA",
  model: null,
  active: true,
  airworthy: true,
  groundedReason: null,
  ...overrides,
});

/** #139: the day by aircraft, a block per leg. */
describe("the day's legs", () => {
  it("are each leg of each flight in flying order, numbered like 2505.1", () => {
    const legs = dayLegs([flight({})]);
    expect(legs.map((l) => [l.label, l.origin, l.destination, l.held])).toEqual([
      ["PGR790.1", "PABE", "9Z8", 5],
      ["PGR790.2", "9Z8", "PABE", 0],
    ]);
    expect(legs[0].stops).toEqual(["PABE", "9Z8", "PABE"]);
  });

  it("are the flight itself when it has one leg, without seats when not asked", () => {
    const [leg] = dayLegs([flight({ legs: [], stops: ["PANC", "PAEN"], origin: "PANC", destination: "PAEN", seats_held_by_leg: null })]);
    expect([leg.label, leg.origin, leg.destination, leg.held, leg.legCount]).toEqual(["PGR790", "PANC", "PAEN", null, 1]);
  });

  it("take the flight's state, airborne between its departure and arrival", () => {
    expect(legState(flight({}))).toBe("planned");
    expect(legState(flight({ status: "released" }))).toBe("released");
    expect(legState(flight({ status: "released", actual_departure_at: "2026-10-30T18:35:00Z" }))).toBe("airborne");
    expect(legState(flight({ status: "released", actual_departure_at: "x", actual_arrival_at: "y" }))).toBe("completed");
    expect(legState(flight({ status: "cancelled" }))).toBe("cancelled");
  });
});

describe("the columns", () => {
  it("are every aircraft that can fly or is grounded, plus any with a leg, by tail", () => {
    const fleet = [
      entry({ id: "ac-503", tail: "N503PA" }),
      entry({ id: "ac-301", tail: "N301PA", active: false, groundedReason: "mel_expired" }),
      entry({ id: "ac-999", tail: "N999PA", active: false }), // stored: no column
    ];
    const columns = aircraftColumns(fleet, dayLegs([flight({})]));
    expect(columns.map((c) => [c.tail, c.grounded, c.legs.length])).toEqual([
      ["N100PA", null, 2],
      ["N301PA", "MEL expired", 0],
      ["N503PA", null, 0],
    ]);
  });

  it("say why an aircraft can't fly", () => {
    expect(groundedLabel(entry({ groundedReason: "manual", active: false }))).toBe("Grounded by maintenance");
    expect(groundedLabel(entry({ groundedReason: "hangar_door", active: false }))).toBe("hangar door");
    expect(groundedLabel(entry({ airworthy: false }))).toBe("Not airworthy");
    expect(groundedLabel(entry({}))).toBeNull();
  });
});

describe("placing legs on the day", () => {
  it("counts minutes from local midnight, across the day's edges", () => {
    expect(minutesInto("2026-10-30", "2026-10-30T18:30:00Z", AK)).toBe(10 * 60 + 30); // 10:30 AKDT
    expect(minutesInto("2026-10-30", "2026-10-31T07:30:00Z", AK)).toBe(23 * 60 + 30);
    expect(minutesInto("2026-10-30", "2026-10-30T07:00:00Z", AK)).toBe(-60); // 23:00 the day before
  });

  it("shows 06:00 to 20:00, widened to every leg", () => {
    expect(hourWindow("2026-10-30", dayLegs([flight({})]), AK)).toEqual({ start: 6, end: 20 });
    const early = flight({ legs: [], scheduled_departure_at: "2026-10-30T12:15:00Z", scheduled_arrival_at: "2026-10-31T05:40:00Z" });
    expect(hourWindow("2026-10-30", dayLegs([early]), AK)).toEqual({ start: 4, end: 22 });
  });

  it("puts each leg at its times, a short hop tall enough to read", () => {
    const placed = placeLegs("2026-10-30", dayLegs([flight({})]), AK, 6);
    expect(placed.map((p) => [p.label, p.top, p.height, p.lane, p.lanes])).toEqual([
      ["PGR790.1", 270, 75, 0, 1], // 10:30 is 4 h 30 min after 06:00
      ["PGR790.2", 360, 75, 0, 1],
    ]);
    const hop = flight({ legs: [], scheduled_departure_at: "2026-10-30T18:00:00Z", scheduled_arrival_at: "2026-10-30T18:05:00Z" });
    expect(placeLegs("2026-10-30", dayLegs([hop]), AK, 6)[0].height).toBe(20);
  });

  it("sets overlapping legs side by side", () => {
    const a = flight({ id: "a", legs: [], scheduled_departure_at: "2026-10-30T18:00:00Z", scheduled_arrival_at: "2026-10-30T19:00:00Z" });
    const b = flight({ id: "b", legs: [], scheduled_departure_at: "2026-10-30T18:30:00Z", scheduled_arrival_at: "2026-10-30T19:30:00Z" });
    const c = flight({ id: "c", legs: [], scheduled_departure_at: "2026-10-30T20:00:00Z", scheduled_arrival_at: "2026-10-30T21:00:00Z" });
    const placed = placeLegs("2026-10-30", dayLegs([c, b, a]), AK, 6);
    expect(placed.map((p) => [p.flightId, p.lane, p.lanes])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 1],
    ]);
  });
});
