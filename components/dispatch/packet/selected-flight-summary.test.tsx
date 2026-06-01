import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";
import type { FlightDetail } from "@/lib/api/types";

import { SelectedFlightSummary } from "./selected-flight-summary";

const baseFlight = (overrides: Partial<FlightDetail> = {}): FlightDetail => ({
  id: "f-1",
  flight_number: "GV101",
  origin: "PADU",
  destination: "PANC",
  scheduled_departure_at: "2026-05-31T14:00:00Z",
  scheduled_arrival_at: "2026-05-31T16:00:00Z",
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

describe("SelectedFlightSummary", () => {
  it("renders the green confirmation row with flight # + route + tail", () => {
    render(<SelectedFlightSummary flight={baseFlight()} />);
    expect(screen.getByText("GV101")).toBeInTheDocument();
    expect(screen.getByText("PADU → PANC")).toBeInTheDocument();
    expect(screen.getByText("N207GE")).toBeInTheDocument();
    expect(screen.getByText("8 pax")).toBeInTheDocument();
    expect(screen.getByText("450 lbs cargo")).toBeInTheDocument();
  });

  it("includes the demo cert id chip in the green confirmation row", () => {
    render(<SelectedFlightSummary flight={baseFlight()} />);
    expect(screen.getByText("DEMO-CERT-1-005")).toBeInTheDocument();
  });

  it("warns when pax_count and cargo_lbs are both zero", () => {
    render(
      <SelectedFlightSummary
        flight={baseFlight({ pax_count: 0, cargo_lbs: 0 })}
      />,
    );
    expect(
      screen.getByText(/No passengers or cargo on manifest/i),
    ).toBeInTheDocument();
  });

  it("warns when only passengers are missing", () => {
    render(
      <SelectedFlightSummary
        flight={baseFlight({ pax_count: 0, cargo_lbs: 500 })}
      />,
    );
    expect(
      screen.getByText(/No passengers on manifest/i),
    ).toBeInTheDocument();
  });

  it("does NOT show the warning row when both pax and cargo are present", () => {
    render(<SelectedFlightSummary flight={baseFlight()} />);
    expect(screen.queryByText(/Needs attention/i)).not.toBeInTheDocument();
  });

  it("always shows the scheduled-PIC row with the demo PIC name", () => {
    render(<SelectedFlightSummary flight={baseFlight()} />);
    expect(screen.getByText(/Scheduled PIC:/i)).toBeInTheDocument();
  });

  it("shows the demo PIC name in the green confirmation + scheduled-PIC rows", () => {
    render(<SelectedFlightSummary flight={baseFlight()} />);
    const matches = screen.getAllByText(/Brian Larson/);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("has no WCAG A/AA violations", async () => {
    const { container } = render(
      <SelectedFlightSummary
        flight={baseFlight({ pax_count: 0, cargo_lbs: 0 })}
      />,
    );
    await expectNoA11yViolations(container);
  });
});
