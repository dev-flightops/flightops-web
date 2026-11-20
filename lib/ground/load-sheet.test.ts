import { describe, expect, it } from "vitest";

import type { ManifestCargoRow, ManifestPaxRow } from "@/lib/api/manifest";

import { loadSheet, onAndOff } from "./load-sheet";

const pax = (over: Partial<ManifestPaxRow>): ManifestPaxRow => ({
  id: over.id ?? `p-${over.first_name}`,
  manifest_id: "m-1",
  first_name: "A",
  last_name: "Passenger",
  weight_lbs: "170.0",
  baggage_lbs: "0.0",
  seat_number: null,
  ticket_type: "revenue",
  is_crew: false,
  is_unaccompanied_minor: false,
  contact_phone: null,
  contact_email: null,
  notes: null,
  check_in_status: "booked",
  ...over,
});

const cargo = (over: Partial<ManifestCargoRow>): ManifestCargoRow => ({
  id: over.id ?? `c-${over.description}`,
  manifest_id: "m-1",
  description: "Freight",
  weight_lbs: "100.0",
  pieces: 1,
  mail_class: null,
  is_hazmat: false,
  hazmat_notes: null,
  shipper: null,
  consignee: null,
  tracking_number: null,
  notes: null,
  ...over,
});

// GVTripleStop after PAVA came off: out of Bethel to Chevak and Hooper Bay
// and back.
const STOPS = ["PABE", "PACM", "PAHP", "PABE"];
const LEGS = [
  { sequence: 1, origin: "PABE", destination: "PACM", scheduled_departure_at: "2026-11-20T18:00:00Z", scheduled_arrival_at: "2026-11-20T18:45:00Z" },
  { sequence: 2, origin: "PACM", destination: "PAHP", scheduled_departure_at: "2026-11-20T19:00:00Z", scheduled_arrival_at: "2026-11-20T19:25:00Z" },
  { sequence: 3, origin: "PAHP", destination: "PABE", scheduled_departure_at: "2026-11-20T19:40:00Z", scheduled_arrival_at: "2026-11-20T20:25:00Z" },
];
const FLIGHT = {
  stops: STOPS,
  legs: LEGS,
  scheduled_departure_at: LEGS[0].scheduled_departure_at,
  scheduled_arrival_at: LEGS[2].scheduled_arrival_at,
};

describe("onAndOff", () => {
  it("reads the stops as ops does: unset is the ends, a return to base is the last stop", () => {
    expect(onAndOff(STOPS, null, null)).toEqual({ on: 0, off: 3 });
    expect(onAndOff(STOPS, "PABE", "PACM")).toEqual({ on: 0, off: 1 });
    expect(onAndOff(STOPS, "pacm", "PABE")).toEqual({ on: 1, off: 3 });
    expect(onAndOff(STOPS, "PAHP", null)).toEqual({ on: 2, off: 3 });
  });

  it("is null for a stop the route doesn't fly, or flies the other way", () => {
    expect(onAndOff(STOPS, "PABE", "PAVA")).toBeNull();
    expect(onAndOff(STOPS, "PAHP", "PACM")).toBeNull();
    expect(onAndOff(["PABE"], null, null)).toBeNull();
  });
});

describe("loadSheet (#208)", () => {
  const manifest = {
    pax: [
      pax({
        first_name: "Bob",
        last_name: "Kalskag",
        boards_at: "PABE",
        leaves_at: "PACM",
        check_in_status: "checked_in",
        baggage_lbs: "62.0",
        bags: [
          { id: "b1", weight_lbs: "40.0", carry_on: false, description: "Blue duffel", status: "aboard" },
          { id: "b2", weight_lbs: "12.0", carry_on: true, description: null, status: "aboard" },
          { id: "b3", weight_lbs: "10.0", carry_on: false, description: "Box", status: "aboard" },
          { id: "b4", weight_lbs: "30.0", carry_on: false, description: "Bumped", status: "bumped" },
        ],
      }),
      pax({ first_name: "Alice", last_name: "Northrup", boards_at: "PABE", leaves_at: "PAHP", baggage_lbs: "35.0", bags_count: 2 }),
      pax({ first_name: "Pat", last_name: "Back", boards_at: "PAHP", leaves_at: "PABE", baggage_lbs: "20.0" }),
      pax({ first_name: "Ella", last_name: "Ramirez", boards_at: "PABE", leaves_at: "PAVA", baggage_lbs: "38.0" }),
      pax({ first_name: "Chris", last_name: "Pilot", is_crew: true, baggage_lbs: "25.0" }),
      pax({ first_name: "Nora", last_name: "Show", leaves_at: "PACM", check_in_status: "no_show", baggage_lbs: "50.0" }),
    ],
    cargo: [
      cargo({ description: "USPS Priority Mail", mail_class: "priority_mail", weight_lbs: "750.0", pieces: 10, leaves_at: "PACM" }),
      cargo({ description: "USPS Priority Mail", id: "c-hp", mail_class: "priority_mail", weight_lbs: "750.0", pieces: 9, leaves_at: "PAHP" }),
      cargo({ description: "Outboard motor", weight_lbs: "300.0", is_hazmat: true, hazmat_notes: "Fuel drained", boards_at: "PAHP" }),
    ],
  };

  it("lists what comes off and goes on at each stop, with the pounds the ramp lifts", () => {
    const sheet = loadSheet(FLIGHT, manifest);
    const names = (g: { passengers: { name: string }[]; lines: { description: string }[] }) => [
      ...g.passengers.map((p) => p.name),
      ...g.lines.map((l) => l.description),
    ];
    expect(sheet.stops.map((s) => [s.icao, names(s.off), names(s.on), s.off.lbs, s.on.lbs])).toEqual([
      ["PABE", [], ["Bob Kalskag", "Alice Northrup", "USPS Priority Mail", "USPS Priority Mail"], 0, 50 + 35 + 750 + 750],
      ["PACM", ["Bob Kalskag", "USPS Priority Mail"], [], 50 + 750, 0],
      ["PAHP", ["Alice Northrup", "USPS Priority Mail"], ["Pat Back", "Outboard motor"], 35 + 750, 20 + 300],
      ["PABE", ["Pat Back", "Outboard motor"], [], 20 + 300, 0],
    ]);
  });

  it("names the checked bags one by one; carry-ons and bumped bags aren't the ramp's", () => {
    const bob = loadSheet(FLIGHT, manifest).stops[1].off.passengers[0];
    expect(bob).toMatchObject({
      name: "Bob Kalskag",
      bags: [
        { weightLbs: 40, description: "Blue duffel" },
        { weightLbs: 10, description: "Box" },
      ],
      bagLbs: 50,
      bagCount: 2,
      carryOns: 1,
      checkedIn: true,
    });
    const alice = loadSheet(FLIGHT, manifest).stops[2].off.passengers[0];
    expect(alice).toMatchObject({ bags: [], bagLbs: 35, bagCount: 2, carryOns: 0, checkedIn: false });
  });

  it("keeps out the crew and no-shows, and sets apart whoever's stop is off the route", () => {
    const sheet = loadSheet(FLIGHT, manifest);
    const all = sheet.stops.flatMap((s) => [...s.on.passengers, ...s.off.passengers]).map((p) => p.name);
    expect(all).not.toContain("Chris Pilot");
    expect(all).not.toContain("Nora Show");
    expect(sheet.notOnRoute.passengers.map((p) => p.name)).toEqual(["Ella Ramirez"]);
    expect(sheet.notOnRoute.lbs).toBe(38);
  });

  it("sets standby and waitlisted passengers apart until they're given a seat (Codex P2)", () => {
    const sheet = loadSheet(FLIGHT, {
      pax: [
        ...manifest.pax,
        pax({ first_name: "Sid", last_name: "Standby", ticket_type: "standby", leaves_at: "PACM", baggage_lbs: "40.0" }),
        pax({ first_name: "Wren", last_name: "Waitlist", is_waitlist: true, leaves_at: "PAHP", baggage_lbs: "25.0" }),
        // Given a seat at check-in: loaded like anyone else.
        pax({ first_name: "Gus", last_name: "Seated", ticket_type: "standby", check_in_status: "checked_in", leaves_at: "PACM", baggage_lbs: "10.0" }),
      ],
      cargo: manifest.cargo,
    });
    expect(sheet.waitingForSeat.passengers.map((p) => p.name)).toEqual(["Sid Standby", "Wren Waitlist"]);
    expect(sheet.waitingForSeat.lbs).toBe(65);
    const chevakOff = sheet.stops[1].off;
    expect(chevakOff.passengers.map((p) => p.name)).toEqual(["Bob Kalskag", "Gus Seated"]);
    expect(chevakOff.lbs).toBe(50 + 10 + 750);
    expect(sheet.stops[2].off.passengers.map((p) => p.name)).toEqual(["Alice Northrup"]);
  });

  it("gives each stop the times the flight lands and leaves", () => {
    const sheet = loadSheet(FLIGHT, manifest);
    expect(sheet.stops.map((s) => [s.arrives, s.departs])).toEqual([
      [null, "2026-11-20T18:00:00Z"],
      ["2026-11-20T18:45:00Z", "2026-11-20T19:00:00Z"],
      ["2026-11-20T19:25:00Z", "2026-11-20T19:40:00Z"],
      ["2026-11-20T20:25:00Z", null],
    ]);
  });

  it("works for a single-leg flight and with no manifest yet", () => {
    const single = loadSheet(
      { stops: ["PABE", "PAHP"], scheduled_departure_at: "2026-11-20T18:00:00Z", scheduled_arrival_at: "2026-11-20T18:50:00Z" },
      null,
    );
    expect(single.stops.map((s) => [s.icao, s.arrives, s.departs, s.on.lbs, s.off.lbs])).toEqual([
      ["PABE", null, "2026-11-20T18:00:00Z", 0, 0],
      ["PAHP", "2026-11-20T18:50:00Z", null, 0, 0],
    ]);
  });
});
