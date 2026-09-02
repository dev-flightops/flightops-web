import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  FlightSearchResponse,
  FlightSearchResult,
} from "@/lib/api/flight-search";

import { FlightResults, formatDay } from "./flight-results";

function flight(overrides: Partial<FlightSearchResult> = {}): FlightSearchResult {
  return {
    flight_id: "f-1",
    flight_number: "PGR900",
    origin: "PANC",
    destination: "PABE",
    scheduled_departure_at: "2026-08-20T17:00:00Z",
    scheduled_arrival_at: "2026-08-20T19:00:00Z",
    status: "scheduled",
    aircraft_tail: "N100PA",
    aircraft_model: "Cessna 208 Caravan",
    seats_total: 9,
    seats_booked: 2,
    seats_available: 7,
    is_available: true,
    unavailable_reason: null,
    ...overrides,
  };
}

function response(
  items: FlightSearchResult[],
  overrides: Partial<FlightSearchResponse> = {},
): FlightSearchResponse {
  return {
    items,
    total: items.length,
    origin: "PANC",
    destination: "PABE",
    search_date: "2026-08-20",
    pax_count: 2,
    ...overrides,
  };
}

const href = (f: FlightSearchResult) => `/book/${f.flight_id}`;

describe("FlightResults", () => {
  it("lists a bookable flight with seats free out of total", () => {
    render(<FlightResults results={response([flight()])} bookingHref={href} />);
    expect(screen.getByText("PGR900")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("/ 9")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Book" })).toHaveAttribute(
      "href",
      "/book/f-1",
    );
  });

  it("offers no Book link on an unbookable flight, and says why", () => {
    render(
      <FlightResults
        results={response([
          flight({
            is_available: false,
            unavailable_reason: "insufficient_seats",
            seats_available: 1,
          }),
        ])}
        bookingHref={href}
      />,
    );
    expect(screen.queryByRole("link", { name: "Book" })).not.toBeInTheDocument();
    expect(screen.getByText("Not enough seats")).toBeInTheDocument();
  });

  it("still shows seats on a departed flight", () => {
    // A departed flight with empty seats is a different problem from a
    // full one; collapsing both to "unavailable" hides which is which.
    render(
      <FlightResults
        results={response([
          flight({
            is_available: false,
            unavailable_reason: "already_departed",
            seats_available: 9,
            seats_booked: 0,
          }),
        ])}
        bookingHref={href}
      />,
    );
    expect(screen.getByText("Already departed")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("trusts the backend's is_available rather than the seat maths", () => {
    // Seats look fine but the backend says no. The row must follow the
    // backend — it is the side that enforces the rule.
    render(
      <FlightResults
        results={response([
          flight({ seats_available: 8, is_available: false, unavailable_reason: "already_departed" }),
        ])}
        bookingHref={href}
      />,
    );
    expect(screen.queryByRole("link", { name: "Book" })).not.toBeInTheDocument();
  });

  it("explains an empty result instead of showing a bare table", () => {
    render(<FlightResults results={response([])} bookingHref={href} />);
    expect(screen.getByRole("status")).toHaveTextContent(/no flights available/i);
    expect(screen.getByRole("status")).toHaveTextContent(/2 passengers/);
  });

  it("captions results with the search that ran", () => {
    // Not with whatever is currently typed — the two diverge the moment
    // someone edits the form without re-searching.
    render(
      <FlightResults
        results={response([flight()], { origin: "PADU", destination: "PAKN" })}
        bookingHref={href}
      />,
    );
    expect(screen.getByText(/PADU → PAKN/)).toBeInTheDocument();
  });

  it("shows no fare column at all", () => {
    // There is no fare model yet; a made-up or blank price column would
    // read as "free" rather than "not priced".
    const { container } = render(
      <FlightResults results={response([flight()])} bookingHref={href} />,
    );
    expect(container.textContent).not.toMatch(/fare|price|\$/i);
  });
});

describe("formatDay", () => {
  it("renders a plain calendar date, not a shifted timestamp", () => {
    // Both zones, because neither alone is sufficient: parsing the
    // string in the host zone breaks east of Greenwich, and formatting
    // the UTC instant without timeZone:UTC breaks west of it. Run only
    // in UTC — as CI does — this assertion passes against either bug.
    for (const tz of ["Asia/Tokyo", "America/Anchorage"]) {
      process.env.TZ = tz;
      expect(formatDay("2026-08-20"), `shifted under TZ=${tz}`).toBe(
        "Aug 20, 2026",
      );
    }
    process.env.TZ = "UTC";
  });
});
