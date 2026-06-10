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

describe("FleetCard", () => {
  it("renders the tail number, model, and Details link to the aircraft detail route", () => {
    render(<FleetCard summary={makeSummary()} />);

    expect(screen.getByText("N207GE")).toBeInTheDocument();
    expect(screen.getByText("Cessna 208")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /details/i });
    expect(link).toHaveAttribute("href", "/maintenance/aircraft/ac-1");
  });

  it("shows the Airworthy pill on a clean card", () => {
    render(<FleetCard summary={makeSummary()} />);

    // The status pill is the only "Airworthy" text on the card —
    // "Advisory" appears as a stat label too, "Grounded" doesn't.
    expect(screen.getByText(/^airworthy$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^grounded$/i)).not.toBeInTheDocument();
  });

  it("shows the Grounded pill when there's a blocking issue", () => {
    render(
      <FleetCard
        summary={makeSummary({
          is_airworthy: false,
          blocking_count: 1,
          open_squawk_count: 1,
        })}
      />,
    );

    expect(screen.getByText(/^grounded$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^airworthy$/i)).not.toBeInTheDocument();
  });

  it("shows the Advisory pill when airworthy but with advisories", () => {
    render(
      <FleetCard
        summary={makeSummary({
          is_airworthy: true,
          advisory_count: 2,
          open_mel_count: 2,
        })}
      />,
    );

    // Both the pill AND the stat label render "Advisory" — assert
    // both are present rather than trying to disambiguate (the
    // sibling Airworthy/Grounded pills are uniquely-named so we can
    // still tell the status apart).
    expect(screen.getAllByText(/^advisory$/i).length).toBe(2);
    expect(screen.queryByText(/^airworthy$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^grounded$/i)).not.toBeInTheDocument();
  });

  it("renders the Inactive chip on retired aircraft", () => {
    render(
      <FleetCard summary={makeSummary({ is_active: false })} />,
    );

    expect(screen.getByText(/^inactive$/i)).toBeInTheDocument();
  });

  it("renders the four count stats", () => {
    render(
      <FleetCard
        summary={makeSummary({
          blocking_count: 1,
          advisory_count: 2,
          open_mel_count: 3,
          open_squawk_count: 4,
        })}
      />,
    );

    expect(screen.getByText(/blocking/i)).toBeInTheDocument();
    expect(screen.getByText(/^advisory$/i)).toBeInTheDocument();
    expect(screen.getByText(/open mel/i)).toBeInTheDocument();
    expect(screen.getByText(/open squawks/i)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});
