import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn(), ApiError: class ApiError extends Error {} }));
vi.mock("@/lib/api/auth", () => ({
  loadZoneTable: async () => ({ byIcao: {}, fallback: "America/Anchorage" }),
}));

import type { FlightSearchResult } from "@/lib/api/flight-search";

import { FlightChoice } from "./flight-choice";

function flight(over: Partial<FlightSearchResult> = {}): FlightSearchResult {
  return {
    flight_id: "f-6969",
    flight_number: "6969",
    origin: "PABE",
    destination: "9Z8",
    scheduled_departure_at: "2026-10-27T17:39:00Z",
    scheduled_arrival_at: "2026-10-27T18:29:00Z",
    route: ["PABE", "9Z8", "PABE"],
    status: "scheduled",
    aircraft_tail: "N503PA",
    aircraft_model: "Cessna 208B",
    seats_total: 9,
    seats_booked: 1,
    seats_available: 8,
    is_available: true,
    unavailable_reason: null,
    ...over,
  };
}

const searched = { origin: "PABE", destination: "9Z8", day: "2026-10-27" };
const query = { origin: "PABE", destination: "9Z8", date: "2026-10-27T09:00", pax: "1" };

describe("which flight the booking goes on (#137)", () => {
  it("names the flight it was opened with, and its open seats", async () => {
    render(await FlightChoice({ flights: [flight()], chosen: flight(), chosenId: "f-6969", searched, query }));
    expect(screen.getByText(/6969/)).toBeInTheDocument();
    expect(screen.getByText(/PABE → 9Z8 → PABE · departs PABE Oct 27, 09:39 AKDT/)).toBeInTheDocument();
    expect(screen.getByText(/8 of 9 seats open on PABE → 9Z8/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Choose another flight/ })).toHaveAttribute(
      "href",
      "/reservations/bookings/new?origin=PABE&destination=9Z8&date=2026-10-27T09%3A00&pax=1",
    );
  });

  it("says when it's the only flight going there that day", async () => {
    render(await FlightChoice({ flights: [flight()], chosen: null, chosenId: null, searched, query }));
    expect(screen.getByText("The flight PABE → 9Z8 on Oct 27, 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Book on this flight/ })).toHaveAttribute(
      "href",
      expect.stringContaining("flight=f-6969"),
    );
    expect(screen.getByText("It's the only flight with seats going there that day.")).toBeInTheDocument();
  });

  it("says when no flight goes there that day", async () => {
    render(await FlightChoice({ flights: [], chosen: null, chosenId: null, searched, query }));
    expect(screen.getByText("No flight goes PABE → 9Z8 on Oct 27, 2026 yet.")).toBeInTheDocument();
  });

  it("lists a full flight without offering it", async () => {
    const full = flight({ is_available: false, unavailable_reason: "insufficient_seats", seats_available: 0 });
    render(await FlightChoice({ flights: [full], chosen: null, chosenId: null, searched, query }));
    expect(screen.getByText(/Not enough seats/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Book on this flight/ })).toBeNull();
  });
});

describe("a return trip's way back (#148)", () => {
  it("picks the way back into its own place, keeping the way out's", async () => {
    const back = flight({ flight_id: "f-792", flight_number: "PGR792", origin: "9Z8", destination: "PABE", route: undefined });
    render(
      await FlightChoice({
        flights: [back],
        chosen: null,
        chosenId: null,
        searched: { origin: "9Z8", destination: "PABE", day: "2026-11-02" },
        query: { ...query, flight: "f-6969", return_date: "2026-11-02" },
        param: "return_flight",
        heading: "Way back",
      }),
    );
    expect(screen.getByRole("region", { name: "Way back" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Book on this flight/ }).getAttribute("href") ?? "";
    const url = new URL(link, "http://x");
    expect(url.searchParams.get("return_flight")).toBe("f-792");
    expect(url.searchParams.get("flight")).toBe("f-6969");
  });
});
