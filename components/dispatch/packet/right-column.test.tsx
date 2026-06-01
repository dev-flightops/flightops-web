import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FlightDetail } from "@/lib/api/types";

import { RightColumn } from "./right-column";

const baseFlight = (overrides: Partial<FlightDetail> = {}): FlightDetail => ({
  id: "flight-uuid-1",
  flight_number: "GV101",
  origin: "PADU",
  destination: "PANC",
  scheduled_departure_at: "2026-06-01T14:00:00Z",
  scheduled_arrival_at: "2026-06-01T16:00:00Z",
  status: "scheduled",
  aircraft: {
    id: "ac-1",
    tail_number: "N207GE",
    model: "Cessna 208 Caravan",
    seats: 9,
  },
  pax_count: 8,
  cargo_lbs: 450,
  notes: null,
  max_payload_lbs: 3000,
  released_at: null,
  released_by: null,
  ...overrides,
});

describe("RightColumn / Generate PDF button", () => {
  it("renders Generate PDF as a disabled button when no flight is selected", () => {
    render(<RightColumn />);
    const btn = screen.getByRole("button", { name: /Generate PDF/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute(
      "title",
      "Pick a scheduled flight above first",
    );
  });

  it("renders Generate PDF as a link to the per-flight release PDF when a flight is selected", () => {
    render(<RightColumn flight={baseFlight()} />);
    const link = screen.getByRole("link", { name: /Generate PDF/i });
    expect(link).toHaveAttribute(
      "href",
      "/api/dispatch/flight-uuid-1/release.pdf",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("keeps Refresh Weather + AI Review disabled regardless of selection", () => {
    render(<RightColumn flight={baseFlight()} />);
    expect(
      screen.getByRole("button", { name: /Refresh Weather/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /AI Review/i }),
    ).toBeDisabled();
  });
});
