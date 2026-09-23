import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FlightListItem } from "@/lib/api/types";

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

  it("formats departure and arrival as UTC", () => {
    render(<TodayFlightsPanel flights={[flight()]} />);
    // Dispatch and flight-following use the same 14:25Z convention; a
    // pilot reading a local-time ETD off this card would be an hour or
    // more out depending on the season.
    expect(screen.getByText(/ETD 14:25Z/)).toBeInTheDocument();
    expect(screen.getByText(/ETA 16:05Z/)).toBeInTheDocument();
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
    expect(screen.getByText("08-21")).toBeInTheDocument();
  });

  it("takes the date from the ISO string rather than a local render", () => {
    // 23:30Z on the 1st is still the 2nd in UTC+1 and the 1st in
    // Alaska. Slicing the ISO string keeps the date matched to the Z
    // times beside it, and keeps the server and client renders the
    // same — parsing through Date would shift it under the reader on
    // hydration.
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
    expect(screen.getByText("06-01")).toBeInTheDocument();
    expect(screen.getByText(/ETD 23:30Z/)).toBeInTheDocument();
  });

  it("says nothing about which day is today", () => {
    // The panel cannot know, and saying so wrongly is what hid a
    // pilot's flight from them.
    const { container } = render(<TodayFlightsPanel flights={[flight()]} />);
    expect(container.textContent).not.toMatch(/\btoday\b/i);
    expect(container.textContent).not.toMatch(/\btomorrow\b/i);
  });
});
