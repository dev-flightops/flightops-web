import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FleetAircraftSummary } from "@/lib/api/types";

import { FleetCard } from "./fleet-card";

function makeSummary(
  overrides: Partial<FleetAircraftSummary> = {},
): FleetAircraftSummary {
  return {
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "Cessna 208" },
    is_active: true,
    is_airworthy: true,
    checked_at: "2026-06-15T20:00:00Z",
    blocking_count: 0,
    advisory_count: 0,
    open_mel_count: 0,
    open_squawk_count: 0,
    airframe_type: null,
    base: null,
    special_notes: null,
    total_time_hours: 0,
    engine_time_hours: 0,
    engine_tbo_hours: null,
    prop_time_hours: 0,
    prop_tbo_hours: null,
    ...overrides,
  };
}

describe("FleetCard (M2-G-22b legacy layout)", () => {
  it("renders tail / model / Details link", () => {
    render(<FleetCard summary={makeSummary()} />);

    expect(screen.getByText("N207GE")).toBeInTheDocument();
    expect(screen.getByText("Cessna 208")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /details/i });
    expect(link).toHaveAttribute("href", "/maintenance/aircraft/ac-1");
  });

  it("falls back to 'No details' when the model is empty", () => {
    render(<FleetCard summary={makeSummary({
      aircraft: { id: "ac-1", tail_number: "N101", model: "" },
    })} />);

    expect(screen.getByText("No details")).toBeInTheDocument();
  });

  it("renders the three time stats with 0.0 hrs placeholders when fields default", () => {
    render(<FleetCard summary={makeSummary()} />);

    expect(screen.getByText("TTAF")).toBeInTheDocument();
    expect(screen.getByText("Engine (SMOH)")).toBeInTheDocument();
    expect(screen.getByText("Prop")).toBeInTheDocument();
    // Three "0.0" stat values
    expect(screen.getAllByText("0.0")).toHaveLength(3);
  });

  it("renders real TTAF / SMOH / Prop hours with US locale grouping (M2-M-17)", () => {
    render(
      <FleetCard
        summary={makeSummary({
          total_time_hours: 3247.5,
          engine_time_hours: 982.3,
          prop_time_hours: 1245,
        })}
      />,
    );

    // TTAF four-digit value gets the comma grouping.
    expect(screen.getByText("3,247.5")).toBeInTheDocument();
    expect(screen.getByText("982.3")).toBeInTheDocument();
    // Integer values keep one decimal so the column reads consistently.
    expect(screen.getByText("1,245.0")).toBeInTheDocument();
  });

  it("renders the '/ TBO' denominator only when a TBO target is set", () => {
    render(
      <FleetCard
        summary={makeSummary({
          engine_time_hours: 1245,
          engine_tbo_hours: 3600,
          prop_time_hours: 1245,
          prop_tbo_hours: null,  // PT6 turboprop on-condition
        })}
      />,
    );

    // Engine row shows the 3,600 TBO denominator.
    expect(screen.getByText(/\/ 3,600/)).toBeInTheDocument();
    // Prop row hides the slash entirely.
    expect(screen.queryByText(/\/ —/)).not.toBeInTheDocument();
  });

  it("renders the airframe chip + base badge when set (M2-M-17)", () => {
    render(
      <FleetCard
        summary={makeSummary({ airframe_type: "caravan", base: "PANC" })}
      />,
    );

    // Caravan slug maps to the CARA abbreviation.
    expect(screen.getByText("CARA")).toBeInTheDocument();
    expect(screen.getByText("PANC")).toBeInTheDocument();
  });

  it("falls back to a 4-char uppercase abbreviation for unknown airframe slugs", () => {
    render(
      <FleetCard
        summary={makeSummary({ airframe_type: "experimental" })}
      />,
    );

    expect(screen.getByText("EXPE")).toBeInTheDocument();
  });

  it("renders the special-notes line with a flag glyph when set", () => {
    render(
      <FleetCard
        summary={makeSummary({ special_notes: "Commuter Seats" })}
      />,
    );

    expect(screen.getByText(/commuter seats/i)).toBeInTheDocument();
  });

  it("omits the special-notes line when the field is null", () => {
    render(<FleetCard summary={makeSummary()} />);

    expect(screen.queryByText(/commuter seats/i)).not.toBeInTheDocument();
  });

  it("shows the green 'All items current' badge on a clean card", () => {
    render(<FleetCard summary={makeSummary()} />);

    expect(screen.getByText(/all items current/i)).toBeInTheDocument();
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/due soon/i)).not.toBeInTheDocument();
  });

  it("shows the red 'N Overdue' badge when blocking_count > 0", () => {
    render(
      <FleetCard
        summary={makeSummary({
          is_airworthy: false,
          blocking_count: 2,
          advisory_count: 1,
          open_squawk_count: 2,
        })}
      />,
    );

    // Overdue wins over Due Soon when both nonzero
    expect(screen.getByText(/2 overdue/i)).toBeInTheDocument();
    expect(screen.queryByText(/due soon/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/all items current/i)).not.toBeInTheDocument();
  });

  it("shows the yellow 'N Due Soon' badge when only advisories are present", () => {
    render(
      <FleetCard
        summary={makeSummary({
          blocking_count: 0,
          advisory_count: 3,
          open_mel_count: 3,
        })}
      />,
    );

    expect(screen.getByText(/3 due soon/i)).toBeInTheDocument();
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/all items current/i)).not.toBeInTheDocument();
  });

  it("renders the Inactive chip on retired aircraft", () => {
    render(<FleetCard summary={makeSummary({ is_active: false })} />);

    expect(screen.getByText(/^inactive$/i)).toBeInTheDocument();
  });
});
