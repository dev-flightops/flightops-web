import { describe, expect, it } from "vitest";
import type { Booking } from "@/lib/api/reservations";
import type { AircraftListItem } from "@/lib/api/types";
import { bookingLanes, matchesBooking, seatCapacity, seatTotals } from "./board-data";

const aircraft = new Map([["ac1", { id: "ac1", seats: 9, tail_number: "N94DM" } as AircraftListItem]]);
function booking(id: string, flight = "f1", overrides: Partial<Booking> = {}): Booking {
  return { id, status: "requested", customer: { full_name: "Demo Traveller" },
    origin_icao: "PANC", destination_icao: "PABE", requested_departure_at: "2026-11-02T07:53:00Z",
    estimated_arrival_at: "2026-11-02T08:53:00Z", flight: { id: flight, aircraft_id: "ac1", flight_number: "DEMO104" },
    passengers: [{ first_name: "Test", last_name: "Companion" }], ...overrides } as Booking;
}
describe("fleet board booking data", () => {
  it("counts capacity once for bookings sharing a flight, while keeping another leg's seats", () => {
    expect(seatCapacity([booking("b1"), booking("b2"), booking("b3", "f2"), booking("b4", "f3", { status: "cancelled" })], aircraft)).toBe(18);
  });
  it("searches named passengers, booking reference, flight and aircraft", () => {
    for (const query of ["companion", "BK-B1", "demo104", "n94dm"]) expect(matchesBooking(booking("b1"), query, aircraft)).toBe(true);
    expect(matchesBooking(booking("b1"), "not present", aircraft)).toBe(false);
  });
  it("puts shared and overlapping bookings in separate lanes, reusing a lane after arrival", () => {
    const result = bookingLanes([booking("b1"), booking("b2"), booking("b3", "f2", { requested_departure_at: "2026-11-02T09:00:00Z", estimated_arrival_at: "2026-11-02T10:00:00Z" })]);
    expect(result.count).toBe(2);
    expect(result.byId.get("b1")).not.toBe(result.byId.get("b2"));
    expect(result.byId.get("b3")).toBe(0);
  });
});


it("separates waiting passengers and does not count an aircraft preference as capacity", () => {
  const waiting = booking("waiting", "", { flight: null, aircraft: { id: "ac1" }, pax_count: 1 } as Partial<Booking>);
  expect(seatTotals([booking("assigned", "f1", { pax_count: 2 }), waiting, booking("cancelled", "f2", { status: "cancelled", pax_count: 9 })], aircraft)).toEqual({ bookedSeats: 2, totalSeats: 9, unassignedPax: 1 });
  expect(seatTotals([waiting], aircraft)).toEqual({ bookedSeats: 0, totalSeats: 0, unassignedPax: 1 });
});
