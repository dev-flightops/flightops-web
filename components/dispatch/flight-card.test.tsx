import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FlightCard } from "./flight-card";
import type { FlightListItem } from "@/lib/api/types";

const flight: FlightListItem = {
  id: "00000000-0000-0000-0000-000000000001",
  flight_number: "GV101",
  origin: "PADU",
  destination: "PANC",
  scheduled_departure_at: "2026-05-27T14:00:00Z",
  scheduled_arrival_at: "2026-05-27T16:00:00Z",
  status: "scheduled",
  aircraft: {
    id: "ac-1",
    tail_number: "N207GE",
    model: "Cessna 208 Caravan",
    seats: 9,
  },
};

describe("FlightCard", () => {
  it("renders flight number + route", () => {
    render(<FlightCard flight={flight} />);
    expect(screen.getByText("GV101")).toBeInTheDocument();
    expect(screen.getByText("PADU → PANC")).toBeInTheDocument();
  });

  it("renders the assigned tail number", () => {
    render(<FlightCard flight={flight} />);
    expect(screen.getByText("N207GE")).toBeInTheDocument();
  });

  it("renders the status badge", () => {
    render(<FlightCard flight={flight} />);
    expect(screen.getByText("scheduled")).toBeInTheDocument();
  });

  it("links to the flight detail page", () => {
    render(<FlightCard flight={flight} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/dispatch/${flight.id}`);
  });

  it("renders status badge with released styling", () => {
    render(<FlightCard flight={{ ...flight, status: "released" }} />);
    expect(screen.getByText("released")).toBeInTheDocument();
  });
});
