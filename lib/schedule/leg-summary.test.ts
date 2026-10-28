import { describe, expect, it } from "vitest";

import type { FlightLoad, ManifestDetailResponse, ManifestPaxRow } from "@/lib/api/manifest";
import type { FlightBooking, FlightBookings } from "@/lib/api/reservations";

import { legsCovered, legSummaries } from "./leg-summary";

const STOPS = ["PABE", "9Z8", "PABE"];

function pax(overrides: Partial<ManifestPaxRow>): ManifestPaxRow {
  return {
    id: "p",
    first_name: "Ada",
    last_name: "Rider",
    weight_lbs: "170",
    baggage_lbs: "20",
    is_crew: false,
    check_in_status: "booked",
    boards_at: "PABE",
    leaves_at: "9Z8",
    ...overrides,
  } as ManifestPaxRow;
}

function booking(id: string, origin: string, destination: string): FlightBooking {
  return {
    id,
    customer: { id: "c", full_name: "Jane Anderson", company_name: null },
    origin_icao: origin,
    destination_icao: destination,
    requested_departure_at: "2026-10-30T18:30:00Z",
    pax_count: 1,
    status: "requested",
    notes: null,
    passengers: [],
  } as FlightBooking;
}

const bookings: FlightBookings = {
  flight_id: "f",
  flight_number: "PGR790",
  route: STOPS,
  seats_total: 9,
  legs: [
    { origin: "PABE", destination: "9Z8", held: 3, open: 6 },
    { origin: "9Z8", destination: "PABE", held: 1, open: 8 },
  ],
  bookings: [booking("out", "PABE", "9Z8"), booking("round", "PABE", "PABE"), booking("back", "9Z8", "PABE")],
};

const manifest = {
  pax: [
    pax({ id: "a", check_in_status: "checked_in" }),
    pax({ id: "b", leaves_at: "PABE", weight_lbs: "180", baggage_lbs: "0" }), // the round trip
    pax({ id: "c", check_in_status: "no_show" }),
    pax({ id: "pilot", is_crew: true, check_in_status: "boarded", boards_at: null, leaves_at: null }),
  ],
  cargo: [{ id: "x", weight_lbs: "120" }, { id: "y", weight_lbs: "30" }],
  load: { useful_load_lbs: 3728, crew_lbs: "190", fuel_lbs: "1361", fuel_counted: true },
} as unknown as ManifestDetailResponse;

const load = { has_manifest: true, load: manifest.load } as unknown as FlightLoad;

/** #139: what each leg carries, for the schedule's flight panel. */
describe("a leg's summary", () => {
  it("covers the legs between two airports, a round trip both", () => {
    expect(legsCovered(STOPS, "PABE", "9Z8")).toEqual([0]);
    expect(legsCovered(STOPS, "9Z8", "PABE")).toEqual([1]);
    expect(legsCovered(STOPS, "PABE", "PABE")).toEqual([0, 1]);
    expect(legsCovered(STOPS, null, null)).toEqual([0, 1]);
    expect(legsCovered(STOPS, "PAEN", "9Z8")).toEqual([0, 1]); // not on the route: the whole flight
  });

  it("counts passengers where they ride, seats as reservations count them", () => {
    const [out, back] = legSummaries({ stops: STOPS, seats: 9, bookings, manifest, load });
    expect([out.checkedIn, out.booked, out.open, out.seats]).toEqual([1, 3, 6, 9]);
    expect([back.checkedIn, back.booked, back.open]).toEqual([0, 1, 8]);
    expect(out.bookings.map((b) => b.id)).toEqual(["out", "round"]);
    expect(back.bookings.map((b) => b.id)).toEqual(["round", "back"]);
  });

  it("weighs the passengers aboard and every freight line, against the useful load less crew and fuel", () => {
    const [out, back] = legSummaries({ stops: STOPS, seats: 9, bookings, manifest, load });
    expect([out.freightItems, out.freightLbs]).toEqual([2, 150]);
    expect(out.manifestedLbs).toBe(190 + 180 + 150); // Ada and her bag, the round-tripper, the freight; no-shows and crew aside
    expect(back.manifestedLbs).toBe(180 + 150);
    expect(out.maximumLbs).toBe(3728 - 190 - 1361);
    expect(out.availableLbs).toBe(2177 - 520);
    expect(out.beforeFuel).toBe(false);
  });

  it("says when the maximum is before fuel, or can't be worked out", () => {
    const noFuel = { load: { ...manifest.load, fuel_lbs: null } } as unknown as FlightLoad;
    expect(legSummaries({ stops: STOPS, seats: 9, bookings, manifest, load: noFuel })[0]).toMatchObject({ maximumLbs: 3538, beforeFuel: true });
    const noUseful = { load: { ...manifest.load, useful_load_lbs: null } } as unknown as FlightLoad;
    expect(legSummaries({ stops: STOPS, seats: 9, bookings, manifest, load: noUseful })[0]).toMatchObject({ maximumLbs: null, availableLbs: null });
  });

  it("works from the aircraft before there is a manifest or a bookings answer", () => {
    const [leg] = legSummaries({ stops: ["PANC", "PAEN"], seats: 9, bookings: null, manifest: null, load: null });
    expect([leg.checkedIn, leg.booked, leg.open, leg.seats, leg.freightItems, leg.manifestedLbs, leg.maximumLbs]).toEqual([0, 0, 9, 9, 0, 0, null]);
  });
});
