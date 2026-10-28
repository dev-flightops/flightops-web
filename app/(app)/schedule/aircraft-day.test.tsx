import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { flightSheetAction } = vi.hoisted(() => ({ flightSheetAction: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn(), ApiError: class ApiError extends Error {} }));
vi.mock("./actions", () => ({ flightSheetAction }));

import { aircraftColumns, dayLegs, placeLegs } from "@/lib/schedule/day-legs";
import type { FlightListItem } from "@/lib/api/types";

import { AircraftDay } from "./aircraft-day";

const AK = "America/Anchorage";
const ZONES = { byIcao: {}, fallback: AK };

const flight: FlightListItem = {
  id: "f-1",
  flight_number: "PGR790",
  origin: "PABE",
  destination: "PABE",
  scheduled_departure_at: "2026-10-30T18:30:00Z",
  scheduled_arrival_at: "2026-10-30T21:15:00Z",
  status: "released",
  aircraft: { id: "ac-100", tail_number: "N100PA", model: "Cessna 208 Caravan", seats: 9 },
  stops: ["PABE", "9Z8", "PABE"],
  legs: [
    { sequence: 1, origin: "PABE", destination: "9Z8", scheduled_departure_at: "2026-10-30T18:30:00Z", scheduled_arrival_at: "2026-10-30T19:45:00Z" },
    { sequence: 2, origin: "9Z8", destination: "PABE", scheduled_departure_at: "2026-10-30T20:00:00Z", scheduled_arrival_at: "2026-10-30T21:15:00Z" },
  ],
  seats_held_by_leg: [5, 0],
};

function columns() {
  const fleet = [
    { id: "ac-100", tail: "N100PA", model: "Cessna 208 Caravan", active: true, airworthy: true, groundedReason: null },
    { id: "ac-301", tail: "N301PA", model: "Cessna 207", active: false, airworthy: false, groundedReason: "mel_expired" },
  ];
  return aircraftColumns(fleet, dayLegs([flight])).map((c) => ({ ...c, legs: placeLegs("2026-10-30", c.legs, AK, 6) }));
}

/** #139: the day by aircraft. */
describe("the schedule by aircraft", () => {
  it("has a column per aircraft, the grounded one saying why", () => {
    render(<AircraftDay columns={columns()} start={6} end={20} zone={AK} zones={ZONES} nowMinute={null} />);
    expect(screen.getByRole("group", { name: "N100PA" })).toBeInTheDocument();
    const grounded = screen.getByRole("group", { name: "N301PA, grounded: MEL expired" });
    expect(within(grounded).queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText("Grounded · MEL expired")).toBeInTheDocument();
  });

  it("puts a block per leg at its times with its seats", () => {
    render(<AircraftDay columns={columns()} start={6} end={20} zone={AK} zones={ZONES} nowMinute={null} />);
    const n100 = screen.getByRole("group", { name: "N100PA" });
    const blocks = within(n100).getAllByRole("button");
    expect(blocks.map((b) => b.getAttribute("aria-label"))).toEqual([
      "PGR790.1, PABE to 9Z8, 10:30–11:45, Released, 5 of 9 seats booked",
      "PGR790.2, 9Z8 to PABE, 12:00–13:15, Released, 0 of 9 seats booked",
    ]);
    expect(blocks[0]).toHaveStyle({ top: `${(4 * 60 + 30) * (64 / 60)}px` });
  });

  it("opens the flight on the leg clicked", async () => {
    flightSheetAction.mockResolvedValueOnce({ ok: false, message: "The flight couldn't be loaded. Try again in a moment." });
    render(<AircraftDay columns={columns()} start={6} end={20} zone={AK} zones={ZONES} nowMinute={null} />);
    fireEvent.click(screen.getByRole("button", { name: /^PGR790\.2/ }));
    expect(await screen.findByRole("dialog", { name: "Flight PGR790" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("9Z8 → PABE");
    expect(flightSheetAction).toHaveBeenCalledWith("f-1");
  });

  it("marks now on today's day only", () => {
    const { rerender } = render(<AircraftDay columns={columns()} start={6} end={20} zone={AK} zones={ZONES} nowMinute={9 * 60} />);
    expect(screen.getByText("Now")).toBeInTheDocument();
    rerender(<AircraftDay columns={columns()} start={6} end={20} zone={AK} zones={ZONES} nowMinute={null} />);
    expect(screen.queryByText("Now")).toBeNull();
  });
});
