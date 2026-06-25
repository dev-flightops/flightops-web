import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./legs-actions", () => ({
  updateLegAction: vi.fn(),
  deleteLegAction: vi.fn(),
  addLegAction: vi.fn(),
}));

import { TrendsTab } from "./trends-tab";
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

describe("TrendsTab", () => {
  it("renders the empty-state hint when the log has no legs", () => {
    render(
      <TrendsTab
        logId="log-1"
        logStatus="draft"
        airframeType="caravan"
        initialLegs={[]}
      />,
    );
    expect(screen.getByText(/no legs to monitor/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Tab 2/ }),
    ).toBeInTheDocument();
  });

  it("hides the Tab-2 link in read-only mode", () => {
    render(
      <TrendsTab
        logId="log-1"
        logStatus="submitted"
        airframeType="caravan"
        initialLegs={[]}
      />,
    );
    expect(
      screen.queryByRole("link", { name: /Tab 2/ }),
    ).not.toBeInTheDocument();
  });

  it("renders the unsupported-airframe hint when airframe_type is null", () => {
    render(
      <TrendsTab
        logId="log-1"
        logStatus="draft"
        airframeType={null}
        initialLegs={[makeLeg({ id: "l-1" })]}
      />,
    );
    expect(
      screen.getByText(/engine trend monitoring not configured/i),
    ).toBeInTheDocument();
  });

  it("renders the turbine field set for a caravan with one leg", () => {
    render(
      <TrendsTab
        logId="log-1"
        logStatus="draft"
        airframeType="caravan"
        initialLegs={[makeLeg({ id: "l-1" })]}
      />,
    );
    expect(screen.getByText(/Cessna 208B Caravan/i)).toBeInTheDocument();
    // Turbine-specific inputs.
    expect(screen.getByLabelText(/ITT T\/O/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/NG T\/O/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/NP Cruise/i)).toBeInTheDocument();
    // Group headers visible.
    expect(screen.getByText(/^Takeoff$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Cruise$/i)).toBeInTheDocument();
  });

  it("renders the piston field set for a c207", () => {
    render(
      <TrendsTab
        logId="log-1"
        logStatus="draft"
        airframeType="c207"
        initialLegs={[makeLeg({ id: "l-1" })]}
      />,
    );
    expect(screen.getByLabelText(/^RPM$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^CHT/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^EGT/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/manifold press/i)).not.toBeInTheDocument();
  });

  it("twin_piston (Navajo) adds the manifold press input on top of piston", () => {
    render(
      <TrendsTab
        logId="log-1"
        logStatus="draft"
        airframeType="navajo"
        initialLegs={[makeLeg({ id: "l-1" })]}
      />,
    );
    expect(screen.getByLabelText(/manifold press/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^RPM$/i)).toBeInTheDocument();
  });

  it("pre-fills inputs from leg.trend_data", () => {
    render(
      <TrendsTab
        logId="log-1"
        logStatus="draft"
        airframeType="caravan"
        initialLegs={[
          makeLeg({
            id: "l-1",
            trend_data: { itt_takeoff_c: 740, fuel_flow_pph: 380.2 },
          }),
        ]}
      />,
    );
    expect(
      (screen.getByLabelText(/ITT T\/O/i) as HTMLInputElement).value,
    ).toBe("740");
    expect(
      (screen.getByLabelText(/Fuel Flow/i) as HTMLInputElement).value,
    ).toBe("380.2");
  });

  it("disables every trend input in read-only mode", () => {
    render(
      <TrendsTab
        logId="log-1"
        logStatus="submitted"
        airframeType="caravan"
        initialLegs={[makeLeg({ id: "l-1" })]}
      />,
    );
    const itt = screen.getByLabelText(/ITT T\/O/i) as HTMLInputElement;
    expect(itt).toBeDisabled();
    const notes = screen.getByLabelText(/Anomalies/i) as HTMLInputElement;
    expect(notes).toBeDisabled();
  });

  it("renders one card per leg with the route in the header", () => {
    render(
      <TrendsTab
        logId="log-1"
        logStatus="draft"
        airframeType="caravan"
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
    expect(screen.getByText(/Leg 1 Trends/i)).toBeInTheDocument();
    expect(screen.getByText(/Leg 2 Trends/i)).toBeInTheDocument();
    expect(screen.getByText(/PANC → PADU/)).toBeInTheDocument();
    expect(screen.getByText(/PADU → PAGM/)).toBeInTheDocument();
  });
});
