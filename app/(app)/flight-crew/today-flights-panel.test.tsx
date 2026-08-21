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
    expect(screen.getByText(/not rostered on any flights today/i)).toBeInTheDocument();
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
