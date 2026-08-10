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

  it("does not surface a placeholder PIC name in the green confirmation row", () => {
    // Flight.pilot_id doesn't exist yet (crew-service ships M3);
    // showing a hardcoded chief-pilot name here misled dispatchers
    // into skipping the PIC picker. Confirmation strip is now
    // tail + load only.
    render(<SelectedFlightSummary flight={baseFlight()} />);
    expect(screen.queryByText("ATP-CFI-0058291")).not.toBeInTheDocument();
    expect(screen.queryByText(/^PIC: /)).not.toBeInTheDocument();
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

  it("shows a muted 'not assigned (M3)' placeholder in the scheduled-PIC row", () => {
    render(<SelectedFlightSummary flight={baseFlight()} />);
    expect(screen.getByText(/Scheduled PIC:/i)).toBeInTheDocument();
    expect(screen.getByText(/not assigned \(M3\)/i)).toBeInTheDocument();
    // Regression guard: the old fallback shipped a real chief-pilot
    // name here even though nothing was persisted on the flight row.
    expect(screen.queryByText(/Sarah Kessler/)).not.toBeInTheDocument();
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
