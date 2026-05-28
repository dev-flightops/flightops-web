import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";
import type { FlightListItem } from "@/lib/api/types";

import { FlightTable } from "./flight-table";

const baseFlight = (overrides: Partial<FlightListItem> = {}): FlightListItem => ({
  id: "00000000-0000-0000-0000-000000000001",
  flight_number: "GV101",
  origin: "PADU",
  destination: "PANC",
  scheduled_departure_at: "2026-05-28T14:00:00Z",
  scheduled_arrival_at: "2026-05-28T16:00:00Z",
  status: "scheduled",
  aircraft: {
    id: "ac-1",
    tail_number: "N207GE",
    model: "Cessna 208 Caravan",
    seats: 9,
  },
  ...overrides,
});

describe("FlightTable", () => {
  it("renders a row per flight with the flight number + route + tail", () => {
    render(
      <FlightTable
        flights={[
          baseFlight(),
          baseFlight({
            id: "2",
            flight_number: "GV103",
            origin: "PANC",
            destination: "PAKN",
            aircraft: {
              id: "ac-2",
              tail_number: "N510PA",
              model: "Beechcraft 1900D",
              seats: 19,
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText("GV101")).toBeInTheDocument();
    expect(screen.getByText("GV103")).toBeInTheDocument();
    expect(screen.getByText("N207GE")).toBeInTheDocument();
    expect(screen.getByText("N510PA")).toBeInTheDocument();
  });

  it("renders the status badge for each flight", () => {
    render(
      <FlightTable
        flights={[
          baseFlight({ status: "scheduled" }),
          baseFlight({ id: "2", flight_number: "GV103", status: "released" }),
        ]}
      />,
    );
    expect(screen.getByText("scheduled")).toBeInTheDocument();
    expect(screen.getByText("released")).toBeInTheDocument();
  });

  it("each row links to /dispatch/{id}", () => {
    render(<FlightTable flights={[baseFlight()]} />);
    const link = screen.getByRole("link", { name: "GV101" });
    expect(link).toHaveAttribute("href", "/dispatch/00000000-0000-0000-0000-000000000001");
  });

  it("has no WCAG A/AA violations", async () => {
    const { container } = render(
      <FlightTable flights={[baseFlight(), baseFlight({ id: "2", flight_number: "GV103" })]} />,
    );
    await expectNoA11yViolations(container);
  });
});
