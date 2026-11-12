import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./place-booking-actions", () => ({ placeBookingAction: vi.fn() }));

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

  it("shows when it wants to go, local at its departure base", () => {
    render(<BookingsAwaitingFlightPanel bookings={[booking()]} />);
    expect(screen.getByText("Sep 12, 09:30 AKDT")).toBeInTheDocument();
  });

  it("tells the dispatcher what to do with them", () => {
    render(<BookingsAwaitingFlightPanel bookings={[booking()]} />);
    expect(
      screen.getByText(/open it to choose another, or build a flight for it here/),
    ).toBeInTheDocument();
  });

  it("counts the ones from earlier days, folded away from today's", () => {
    // #134: seventeen from the week before, oldest first, sat above the
    // booking made that morning. The page asks for today on; the panel
    // says how many older ones there are and whose they are to clear.
    render(<BookingsAwaitingFlightPanel bookings={[booking()]} earlier={17} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(
      screen.getByText("17 more are from earlier days: check Reservations to rebook or cancel them."),
    ).toBeInTheDocument();
  });

  it("says nothing about earlier days when there are none", () => {
    render(<BookingsAwaitingFlightPanel bookings={[booking()]} />);
    expect(screen.queryByText(/earlier days/)).not.toBeInTheDocument();
  });
});

describe("the day a booking is for (#174)", () => {
  it("is the day at its departure base, not the UTC day", () => {
    // 15:00 in Bethel is already tomorrow in UTC.
    render(
      <BookingsAwaitingFlightPanel
        bookings={[booking({ origin_icao: "PABE", requested_departure_at: "2026-11-10T00:00:00Z" })]}
      />,
    );
    expect(screen.getByText("Nov 9, 15:00 AKST")).toBeInTheDocument();
  });
});

describe("bookings from earlier days (#174)", () => {
  it("still shows when nothing waits today: a flight cancelled the day after puts its passengers here", () => {
    render(
      <BookingsAwaitingFlightPanel bookings={[]} earlier={1} earlierBookings={[booking({ customer: { id: "c-2", full_name: "Marcus Tester", company_name: null } })]} />,
    );
    expect(screen.getByRole("region", { name: "Bookings awaiting a flight" })).toBeInTheDocument();
    expect(screen.getByText("1 is from earlier days: check Reservations to rebook or cancel it.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Marcus Tester", hidden: true })).toHaveAttribute("href", "/reservations/bookings/b-1");
  });

  it("says more beside today's, folded away", () => {
    render(
      <BookingsAwaitingFlightPanel bookings={[booking()]} earlier={2} earlierBookings={[booking({ id: "b-8" }), booking({ id: "b-9" })]} />,
    );
    expect(screen.getByText("2 more are from earlier days: check Reservations to rebook or cancel them.")).toBeInTheDocument();
    expect(screen.getByRole("group")).not.toHaveAttribute("open");
  });

  it("renders nothing when nothing waits from any day", () => {
    const { container } = render(<BookingsAwaitingFlightPanel bookings={[]} earlier={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the flights a waiting booking could go on (LOG-05)", () => {
  const offer = (n: string, over: Record<string, unknown> = {}) => ({
    flight_id: `f-${n}`,
    flight_number: n,
    route: ["PAHP", "PABE"],
    departs_at: "2026-09-12T18:00:00Z",
    aircraft_tail: "N503PA",
    seats_available: 4,
    payload_left_lbs: "820",
    fits: true,
    short_of: null,
    ...over,
  });

  it("offers the ones it fits, each placed with one click", () => {
    render(
      <BookingsAwaitingFlightPanel
        bookings={[booking()]}
        offers={{ "b-1": [offer("PGR101"), offer("PGR102", { fits: false, short_of: "seats", seats_available: 0 }), offer("PGR103", { payload_left_lbs: null })] }}
      />,
    );
    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual([
      "Place on PGR10110:00 AKDT · 4 seats · 820 lb left",
      "Place on PGR10310:00 AKDT · 4 seats · payload not on file",
    ]);
    expect(screen.getByText(/Place one on a flight it fits/)).toBeInTheDocument();
  });

  it("says when none that day has room", () => {
    render(
      <BookingsAwaitingFlightPanel bookings={[booking()]} offers={{ "b-1": [offer("PGR102", { fits: false, short_of: "payload" })] }} />,
    );
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.getByText("No flight that day on its route has room for it: build one, or open it to choose.")).toBeInTheDocument();
  });
});
