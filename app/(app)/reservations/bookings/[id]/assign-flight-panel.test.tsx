import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FlightSearchResult } from "@/lib/api/flight-search";

vi.mock("./actions", () => ({
  assignFlightAction: vi.fn(),
}));

import { AssignFlightPanel } from "./assign-flight-panel";

/**
 * Putting a booking on a flight.
 *
 * Client bug report 8/28: "After I've built the reservation, I don't
 * see how to assign or build a flight that can service that
 * reservation." The endpoint and the seat-aware search had both been
 * here since M3 with nothing on screen calling either.
 */

function flight(over: Partial<FlightSearchResult> = {}): FlightSearchResult {
  return {
    flight_id: "f-1",
    flight_number: "PGR120",
    origin: "PAHP",
    destination: "PABE",
    scheduled_departure_at: "2026-09-12T17:30:00Z",
    scheduled_arrival_at: "2026-09-12T18:10:00Z",
    status: "scheduled",
    aircraft_tail: "N100PA",
    aircraft_model: "Cessna 208 Caravan",
    seats_total: 9,
    seats_booked: 4,
    seats_available: 5,
    is_available: true,
    unavailable_reason: null,
    ...over,
  };
}

function panel(
  candidates: FlightSearchResult[] = [flight()],
  assigned: string | null = null,
  paxCount = 1,
) {
  render(
    <AssignFlightPanel
      bookingId="b-1"
      candidates={candidates}
      assignedFlightNumber={assigned}
      paxCount={paxCount}
    />,
  );
}

describe("a booking with no flight", () => {
  it("says it is waiting on dispatch", () => {
    panel();
    expect(
      screen.getByText(/Not on a flight yet — this booking is waiting/),
    ).toBeInTheDocument();
  });

  it("offers the flights on that route and day", () => {
    panel();
    expect(screen.getByText("PGR120")).toBeInTheDocument();
    expect(screen.getByText("5 seats free")).toBeInTheDocument();
  });

  it("cannot assign until a flight is chosen", () => {
    panel();
    expect(
      screen.getByRole("button", { name: "Assign to flight" }),
    ).toBeDisabled();
  });
});

describe("a booking already on a flight", () => {
  it("names the flight", () => {
    panel([flight()], "PGR120");
    // Scoped to the status line — the same number also appears in the
    // candidate list underneath, which is the point of keeping the
    // list visible.
    const status = screen.getByText(/^On/).closest("p")!;
    expect(within(status).getByText("PGR120")).toBeInTheDocument();
  });

  it("still offers the list, because moving is the same operation", () => {
    panel([flight()], "PGR120");
    expect(
      screen.getByRole("button", { name: "Assign to flight" }),
    ).toBeInTheDocument();
  });
});

describe("a flight the server says cannot take it", () => {
  const full = flight({
    seats_available: 1,
    is_available: false,
    unavailable_reason: "insufficient_seats",
  });

  it("is listed rather than hidden", () => {
    // A dispatcher looking at an unserviced booking needs to see that
    // the 17:30 exists and is full. An empty list reads as "no flights
    // that day", which is a different problem with a different answer.
    panel([full], null, 3);
    expect(screen.getByText("PGR120")).toBeInTheDocument();
  });

  it("says why it cannot take the party", () => {
    panel([full], null, 3);
    expect(screen.getByText("full — 1 of 3 seats")).toBeInTheDocument();
  });

  it("cannot be selected", () => {
    panel([full], null, 3);
    expect(screen.getByRole("radio")).toBeDisabled();
  });
});

describe("no flights on that route that day", () => {
  it("says so rather than showing an empty list", () => {
    panel([]);
    expect(
      screen.getByText("No flights scheduled on this route that day."),
    ).toBeInTheDocument();
  });

  it("points at building one", () => {
    // The other half of the report: "how does dispatch know they need
    // to make a new flight?" When there is nothing to assign to, the
    // answer is to build one.
    panel([]);
    const link = screen.getByRole("link", { name: /Build a flight for it/ });
    expect(link).toHaveAttribute("href", "/dispatch");
  });

  it("offers no assign button with nothing to assign to", () => {
    panel([]);
    expect(
      screen.queryByRole("button", { name: "Assign to flight" }),
    ).not.toBeInTheDocument();
  });
});

describe("availability comes from the server", () => {
  it("shows the seat count it was given, not one derived here", () => {
    panel([flight({ seats_total: 9, seats_booked: 4, seats_available: 2 })]);
    expect(screen.getByText("2 seats free")).toBeInTheDocument();
    expect(screen.queryByText("5 seats free")).not.toBeInTheDocument();
  });

  it("blocks a departed flight even though it has seats", () => {
    // The bug this replaced: availability was derived from seat counts
    // here, so a completed flight was offered as assignable with "9
    // seats free" and the assignment came back
    // flight_not_assignable_in_status_completed. Seats were never the
    // only reason a flight cannot take a booking.
    panel([
      flight({
        seats_available: 9,
        is_available: false,
        unavailable_reason: "already_departed",
      }),
    ]);
    expect(screen.getByRole("radio")).toBeDisabled();
    expect(screen.getByText("already departed")).toBeInTheDocument();
    expect(screen.queryByText("9 seats free")).not.toBeInTheDocument();
  });

  it("blocks a flight whose reason this page has not learned yet", () => {
    // A reason the server adds later must not fall through as
    // selectable just because there is no label for it.
    panel([
      flight({
        is_available: false,
        unavailable_reason: null,
      }),
    ]);
    expect(screen.getByRole("radio")).toBeDisabled();
    expect(screen.getByText("not available")).toBeInTheDocument();
  });
});

describe("the section", () => {
  it("is labelled so it can be found", () => {
    panel();
    expect(
      within(screen.getByRole("region", { name: "Flight assignment" })).getByText(
        "Flight",
      ),
    ).toBeInTheDocument();
  });
});
