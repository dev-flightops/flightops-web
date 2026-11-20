import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FlightListItem, WeatherReportResponse } from "@/lib/api/types";

import { TodayFlightsPanel } from "./today-flights-panel";

function flight(overrides: Partial<FlightListItem> = {}): FlightListItem {
  return {
    id: "f-1",
    flight_number: "PGR205",
    origin: "PAKN",
    destination: "PADU",
    scheduled_departure_at: "2026-08-21T14:25:00Z",
    scheduled_arrival_at: "2026-08-21T16:05:00Z",
    status: "scheduled",
    aircraft: { id: "a-1", tail_number: "N100PA", model: "PC-12" },
    ...overrides,
  } as FlightListItem;
}

describe("TodayFlightsPanel", () => {
  it("renders a card per flight with a preflight CTA", () => {
    render(<TodayFlightsPanel flights={[flight()]} />);
    expect(screen.getByText("PGR205")).toBeInTheDocument();
    expect(screen.getByText("PAKN → PADU")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Begin Preflight/i })).toHaveAttribute(
      "href",
      "/flight-crew/preflight/f-1",
    );
  });

  it("shows departure and arrival in the departure base's time, with the Zulu beside them", () => {
    // #68: times are the base's, as Flight Following shows them; the
    // Zulu stays beside them for the flight plan.
    render(<TodayFlightsPanel flights={[flight()]} />);
    expect(screen.getByText(/ETD 06:25 AKDT · ETA 08:05 AKDT/)).toBeInTheDocument();
    expect(screen.getByText("14:25Z–16:05Z")).toBeInTheDocument();
  });

  it("opens the preflight at its fuel from Order fuel", () => {
    render(<TodayFlightsPanel flights={[flight()]} />);
    expect(screen.getByRole("link", { name: /Order fuel/i })).toHaveAttribute(
      "href",
      "/flight-crew/preflight/f-1#preflight-fuel-heading",
    );
  });

  it("says you are not rostered, not that nothing is flying", () => {
    // The panel used to list every flight in the tenant, so empty meant
    // "no flights today at all". It now means "dispatch has not put you
    // on anything", which is a different message — and the wrong one to
    // get silently, because a pilot who IS expected to fly should ring
    // dispatch rather than assume the page is broken.
    const { container } = render(<TodayFlightsPanel flights={[]} />);
    expect(
      screen.getByText(/not rostered on any flights just now/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/check with dispatch/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/no flights (today|scheduled)/i);
  });

  it("keeps the manual-log escape hatch on the empty state", () => {
    // Off-schedule flying happens — a ferry leg, a maintenance
    // repositioning — and it still has to be logged.
    render(<TodayFlightsPanel flights={[]} />);
    expect(screen.getByRole("link", { name: /create a manual log/i })).toHaveAttribute(
      "href",
      "/flight-crew/elog",
    );
  });

  it("renders every assigned flight rather than only the first", () => {
    render(
      <TodayFlightsPanel
        flights={[
          flight(),
          flight({ id: "f-2", flight_number: "PGR206", origin: "PADU" }),
        ]}
      />,
    );
    expect(screen.getAllByRole("link", { name: /Begin Preflight/i })).toHaveLength(2);
  });
});

/**
 * The time-zone fault this panel was changed to avoid.
 *
 * The page asked the server for one UTC day and called it today. At
 * 16:00 in Alaska it is already tomorrow in UTC, so a pilot's own
 * evening flight vanished behind "not rostered on any flights today"
 * and the page offered no other way to reach a preflight. Same fault as
 * the fleet-board calendar arrows on 8/24.
 *
 * The panel's half of the fix is to do no calendar arithmetic: list
 * what it was given, in order, with each card's date on it.
 */
describe("dates on the cards", () => {
  it("puts a date on every card", () => {
    // Without it, two cards are indistinguishable as to which is
    // tonight's flight.
    render(<TodayFlightsPanel flights={[flight()]} />);
    expect(screen.getByText("Aug 21")).toBeInTheDocument();
  });

  it("dates the flight on the departure base's day, not UTC's", () => {
    // 23:30Z on the 1st is 15:30 on the 1st in Alaska. The date and
    // times are formatted in the base's named zone, so the server and
    // the browser render the same thing whatever zone either is in.
    render(
      <TodayFlightsPanel
        flights={[
          flight({
            scheduled_departure_at: "2026-06-01T23:30:00Z",
            scheduled_arrival_at: "2026-06-02T01:00:00Z",
          }),
        ]}
      />,
    );
    expect(screen.getByText("Jun 1")).toBeInTheDocument();
    expect(screen.getByText(/ETD 15:30 AKDT/)).toBeInTheDocument();
    expect(screen.getByText("23:30Z–01:00Z")).toBeInTheDocument();
  });

  it("says nothing about which day is today", () => {
    // The panel cannot know, and saying so wrongly is what hid a
    // pilot's flight from them.
    const { container } = render(<TodayFlightsPanel flights={[flight()]} />);
    expect(container.textContent).not.toMatch(/\btoday\b/i);
    expect(container.textContent).not.toMatch(/\btomorrow\b/i);
  });
});

// 20 Nov, the client: "the ability to see routing/current weather
// (winds/ceiling/vis), so that I can order fuel while I'm still in the air."
describe("the next flight, read from the air", () => {
  const metar = (over: Partial<WeatherReportResponse> = {}): WeatherReportResponse =>
    ({
      icao: "PAKN",
      kind: "metar",
      raw: "METAR PAKN 211353Z 27008KT 10SM CLR",
      parsed_at: "2026-08-21T14:00:00Z",
      observed_at: "2026-08-21T13:53:00Z",
      flight_category: "VFR",
      visibility_sm: 10,
      ceiling_ft: null,
      wind_direction_deg: 270,
      wind_speed_kt: 8,
      wind_gust_kt: null,
      wind_variable: false,
      wind_calm: false,
      ...over,
    }) as WeatherReportResponse;

  it("gives each stop once with its wind, visibility and ceiling, and says when there's no METAR", () => {
    render(
      <TodayFlightsPanel
        flights={[flight({ stops: ["PAKN", "PADU", "PAKN"] } as Partial<FlightListItem>)]}
        weather={{ PAKN: metar() }}
      />,
    );
    const now = screen.getByRole("region", { name: "Weather now" });
    expect(within(now).getAllByText("PAKN")).toHaveLength(1);
    expect(within(now).getByText("270° @ 8 kt · 10.0 SM · Clear")).toBeInTheDocument();
    expect(within(now).getByText("METAR 13:53Z")).toBeInTheDocument();
    expect(within(now).getByText("No current METAR")).toBeInTheDocument();
  });

  it("shows the fuel, the load and the passengers as the preflight does", () => {
    render(
      <TodayFlightsPanel
        flights={[flight()]}
        ready={{
          "f-1": {
            fuelOrders: [],
            assignment: null,
            flightLoad: {
              checked_in: { count: 1, weight_lbs: "180", baggage_lbs: "20" },
              to_check_in: { count: 1, weight_lbs: "170", baggage_lbs: "10" },
            } as never,
          },
        }}
      />,
    );
    const ready = screen.getByRole("region", { name: "Ready to go" });
    expect(within(ready).getByText(/No fuel ordered/i)).toBeInTheDocument();
    expect(within(ready).getByText(/No load team/i)).toBeInTheDocument();
    expect(within(ready).getByText(/1 of 2 checked in/i)).toBeInTheDocument();
  });

  it("leaves the weather and readiness out when the page couldn't read them", () => {
    render(<TodayFlightsPanel flights={[flight()]} />);
    expect(screen.queryByRole("region", { name: "Weather now" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Ready to go" })).toBeNull();
  });
});
