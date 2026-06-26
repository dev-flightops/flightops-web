import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FlightLogLeg } from "@/lib/api/types";

import { SummaryTab } from "./summary-tab";

function leg(over: Partial<FlightLogLeg> = {}): FlightLogLeg {
  return {
    id: `leg-${Math.random().toString(36).slice(2, 8)}`,
    flight_log_id: "log-1",
    leg_number: 1,
    origin_icao: null,
    dest_icao: null,
    engine_on: null,
    blocks_off: null,
    blocks_on: null,
    engine_off: null,
    crosses_midnight: false,
    start_hobbs: null,
    end_hobbs: null,
    landings: 0,
    night_landings: 0,
    pilot_flying: "pic",
    routing: null,
    basic_empty_weight_lbs: null,
    pilot_weight_lbs: null,
    sic_weight_lbs: null,
    pax_weight_lbs: null,
    baggage_weight_lbs: null,
    cargo_weight_lbs: null,
    fuel_gallons: null,
    fuel_weight_lbs: null,
    trend_data: {},
    ...over,
  };
}

describe("SummaryTab", () => {
  it("renders the empty state when there are no legs", () => {
    render(<SummaryTab legs={[]} />);
    expect(screen.getByText(/no legs entered yet/i)).toBeInTheDocument();
    expect(screen.getByText(/tab 2 \(legs\)/i)).toBeInTheDocument();
  });

  it("renders three big tiles with totals to one decimal place", () => {
    render(
      <SummaryTab
        legs={[
          leg({
            engine_on: "08:00:00",
            engine_off: "09:30:00",
            blocks_off: "08:05:00",
            blocks_on: "09:25:00",
            start_hobbs: 100,
            end_hobbs: 101.5,
          }),
        ]}
      />,
    );
    expect(screen.getByText("Total Flight Time")).toBeInTheDocument();
    expect(screen.getByText("Total Block Time")).toBeInTheDocument();
    expect(screen.getByText("Total Hobbs")).toBeInTheDocument();
    // 1h30m flight + 1.5 hobbs → both render "1.5"; block 80min → 1.3.
    expect(screen.getAllByText("1.5")).toHaveLength(2);
    expect(screen.getByText("1.3")).toBeInTheDocument();
  });

  it("renders an em dash when a total can't be computed", () => {
    render(
      <SummaryTab
        legs={[leg({ engine_on: "08:00:00", engine_off: null })]}
      />,
    );
    // All three tiles render "—" since no leg has complete data.
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("renders the counter row with leg / landings / night / fuel totals", () => {
    render(
      <SummaryTab
        legs={[
          leg({ landings: 1, night_landings: 0, fuel_gallons: 30 }),
          leg({ landings: 2, night_landings: 1, fuel_gallons: 45 }),
        ]}
      />,
    );
    expect(screen.getByText("Legs")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // leg count
    expect(screen.getByText("Landings")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // total landings
    expect(screen.getByText("Night Ldgs")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // night landings
    expect(screen.getByText("Fuel (gal)")).toBeInTheDocument();
    expect(screen.getByText("75.0")).toBeInTheDocument();
  });

  it("renders the totals-from-legs footnote hint", () => {
    render(<SummaryTab legs={[leg({ engine_on: "08:00", engine_off: "09:00" })]} />);
    expect(
      screen.getByText(/derived from tab 2/i),
    ).toBeInTheDocument();
  });
});
