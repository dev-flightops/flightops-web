import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Booking } from "@/lib/api/reservations";

import { BookingsAwaitingFlightPanel } from "./bookings-awaiting-flight-panel";

/**
 * The dispatch queue for reservations nobody has put on a flight.
 *
 * Client bug report 8/28: "if a new booking is made, how does dispatch
 * know they need to make a new flight to service that reservation?"
 * They didn't.
 */

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: "b-1",
    customer: { id: "c-1", full_name: "Mary Andrew" },
    origin_icao: "PAHP",
    destination_icao: "PABE",
    requested_departure_at: "2026-09-12T17:30:00Z",
    estimated_arrival_at: null,
    aircraft: null,
    flight: null,
    pax_count: 1,
    cargo_notes: null,
    quoted_total_cents: null,
    status: "confirmed",
    notes: null,
    quoted_at: null,
    confirmed_at: null,
    confirmed_by: null,
    completed_at: null,
    cancelled_at: null,
    cancelled_by: null,
    cancelled_reason: null,
    created_at: "2026-09-09T10:00:00Z",
    updated_at: "2026-09-09T10:00:00Z",
    ...over,
  } as Booking;
}

describe("when there is nothing waiting", () => {
  it("renders nothing at all", () => {
    // Not an empty panel. A dispatcher with a clear queue should not
    // have a box telling them so taking up the top of the packet.
    const { container } = render(
      <BookingsAwaitingFlightPanel bookings={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("when bookings are waiting", () => {
  it("counts them in the header", () => {
    render(
      <BookingsAwaitingFlightPanel
        bookings={[booking(), booking({ id: "b-2" })]}
      />,
    );
    const panel = within(
      screen.getByRole("region", { name: "Bookings awaiting a flight" }),
    );
    expect(panel.getByText("2")).toBeInTheDocument();
  });

  it("names the customer and links to the booking", () => {
    // The link is the fix for the other half of the report — "I don't
    // see how to assign or build a flight" — so it has to go
    // somewhere useful.
    render(<BookingsAwaitingFlightPanel bookings={[booking()]} />);
    const link = screen.getByRole("link", { name: "Mary Andrew" });
    expect(link).toHaveAttribute("href", "/reservations/bookings/b-1");
  });

  it("shows the route and party size", () => {
    render(<BookingsAwaitingFlightPanel bookings={[booking({ pax_count: 3 })]} />);
    // The line is built from several JSX expressions, so it lands as
    // separate text nodes. Read the row's whole text instead.
    const row = screen.getByRole("listitem");
    expect(row.textContent?.replace(/\s+/g, " ")).toContain(
      "PAHP → PABE · 3 pax",
    );
  });

  it("shows the requested date without a timezone to get wrong", () => {
    // A bare date through new Date() lands at UTC midnight and renders
    // a day early west of Greenwich — the calendar-arrow bug from
    // 8/24. Read from the ISO string instead.
    render(<BookingsAwaitingFlightPanel bookings={[booking()]} />);
    expect(screen.getByText("2026-09-12")).toBeInTheDocument();
  });

  it("tells the dispatcher what to do with them", () => {
    render(<BookingsAwaitingFlightPanel bookings={[booking()]} />);
    expect(
      screen.getByText(/put it on an existing flight, or build one/),
    ).toBeInTheDocument();
  });
});
