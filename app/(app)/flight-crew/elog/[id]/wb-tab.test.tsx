import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./legs-actions", () => ({
  updateLegAction: vi.fn(),
  deleteLegAction: vi.fn(),
  addLegAction: vi.fn(),
}));

import { WeightBalanceTab } from "./wb-tab";
import type { FlightLogLeg } from "@/lib/api/types";

function makeLeg(over: Partial<FlightLogLeg> & { id: string }): FlightLogLeg {
  return {
    flight_log_id: "log-1",
    leg_number: 1,
    origin_icao: "PANC",
    dest_icao: "PADU",
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

describe("WeightBalanceTab", () => {
  it("renders the empty-state hint pointing back to Tab 2 when no legs exist", () => {
    render(
      <WeightBalanceTab logId="log-1" logStatus="draft" initialLegs={[]} />,
    );
    expect(screen.getByText(/no legs to load yet/i)).toBeInTheDocument();
    const tab2 = screen.getByRole("link", { name: /Tab 2/ });
    expect(tab2.getAttribute("href")).toBe(
      "/flight-crew/elog/log-1?tab=legs",
    );
  });

  it("hides the Tab-2 link in read-only mode", () => {
    render(
      <WeightBalanceTab
        logId="log-1"
        logStatus="submitted"
        initialLegs={[]}
      />,
    );
    expect(
      screen.queryByRole("link", { name: /Tab 2/ }),
    ).not.toBeInTheDocument();
  });

  it("renders one W&B card per leg with route header + ramp weight slot", () => {
    render(
      <WeightBalanceTab
        logId="log-1"
        logStatus="draft"
        initialLegs={[
          makeLeg({ id: "l-1" }),
          makeLeg({
            id: "l-2",
            leg_number: 2,
            origin_icao: "PADU",
            dest_icao: "PAGM",
          }),
        ]}
      />,
    );
    expect(screen.getByText(/Leg 1 W&B/i)).toBeInTheDocument();
    expect(screen.getByText(/Leg 2 W&B/i)).toBeInTheDocument();
    expect(screen.getByText(/PANC → PADU/)).toBeInTheDocument();
    expect(screen.getByText(/PADU → PAGM/)).toBeInTheDocument();
  });

  it("ramp weight reads — when BEW is missing", () => {
    render(
      <WeightBalanceTab
        logId="log-1"
        logStatus="draft"
        initialLegs={[
          makeLeg({
            id: "l-1",
            pilot_weight_lbs: 195,
            pax_weight_lbs: 600,
            // basic_empty_weight_lbs intentionally null
          }),
        ]}
      />,
    );
    // The Ramp Weight slot shows a dash when BEW is missing — pilots
    // get a dash instead of a misleading partial-sum total.
    const card = screen.getByText(/Leg 1 W&B/i).closest("div")!;
    const cardParent = card.parentElement!.parentElement!;
    expect(
      within(cardParent).getByText(/Ramp Weight/i).parentElement,
    ).toHaveTextContent(/—/);
  });

  it("ramp weight sums BEW + pilot + SIC + PAX + baggage + cargo + fuel_weight", () => {
    // Legacy sum: 4825 + 195 + 175 + 612 + 84 + 220 + 1477 = 7588.
    render(
      <WeightBalanceTab
        logId="log-1"
        logStatus="draft"
        initialLegs={[
          makeLeg({
            id: "l-1",
            basic_empty_weight_lbs: 4825,
            pilot_weight_lbs: 195,
            sic_weight_lbs: 175,
            pax_weight_lbs: 612,
            baggage_weight_lbs: 84,
            cargo_weight_lbs: 220,
            fuel_weight_lbs: 1477,
          }),
        ]}
      />,
    );
    expect(screen.getByText("7588")).toBeInTheDocument();
  });

  it("hides Takeoff / Landing / CG behind a 'Needs aircraft config' hint", () => {
    render(
      <WeightBalanceTab
        logId="log-1"
        logStatus="draft"
        initialLegs={[makeLeg({ id: "l-1" })]}
      />,
    );
    expect(screen.getByText(/Takeoff Wt/i)).toBeInTheDocument();
    expect(screen.getByText(/Landing Wt/i)).toBeInTheDocument();
    expect(screen.getByText(/^CG$/)).toBeInTheDocument();
    // All three carry the M3 hint.
    expect(
      screen.getAllByText(/needs aircraft config/i).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("disables every W&B input in read-only (submitted) mode", () => {
    render(
      <WeightBalanceTab
        logId="log-1"
        logStatus="submitted"
        initialLegs={[
          makeLeg({ id: "l-1", basic_empty_weight_lbs: 4825 }),
        ]}
      />,
    );
    const bew = screen.getByLabelText(
      /basic empty weight/i,
    ) as HTMLInputElement;
    expect(bew).toBeDisabled();
    const fuel = screen.getByLabelText(/^fuel gallons$/i) as HTMLInputElement;
    expect(fuel).toBeDisabled();
  });
});
