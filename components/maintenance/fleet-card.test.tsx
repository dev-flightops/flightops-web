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

  it("renders the three time stats with 0.0 hrs placeholders (M2-M-17 fills these in)", () => {
    render(<FleetCard summary={makeSummary()} />);

    expect(screen.getByText("TTAF")).toBeInTheDocument();
    expect(screen.getByText("Engine (SMOH)")).toBeInTheDocument();
    expect(screen.getByText("Prop")).toBeInTheDocument();
    // Three "0.0" stat values
    expect(screen.getAllByText("0.0")).toHaveLength(3);
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
