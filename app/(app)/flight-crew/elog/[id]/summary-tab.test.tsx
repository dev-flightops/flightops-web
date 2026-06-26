import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FlightLogLeg, FlightLogResponse } from "@/lib/api/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./summary-actions", () => ({
  updateSummaryAction: vi.fn(),
}));

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

function makeLog(over: Partial<FlightLogResponse> = {}): FlightLogResponse {
  return {
    id: "log-1",
    log_number: "LOG-20260615-150000",
    aircraft: {
      id: "ac-1",
      tail_number: "N207GE",
      model: "C208",
      seats: 9,
      airframe_type: "caravan",
    },
    flight_id: null,
    flight_number: null,
    flight_type: "advisory",
    flight_date: "2026-06-15",
    status: "draft",
    is_manual_entry: false,
    created_by: { id: "u-1", full_name: "Pilot", email: "p@x.test" },
    created_at: "2026-06-15T12:00:00Z",
    vor_identifier: null,
    vor_check_type: null,
    vor_station_facility: null,
    vor_location: null,
    vor_bearing_indicated: null,
    vor_bearing_known: null,
    vor_error_degrees: null,
    vor_checked_at: null,
    vor_certified: false,
    mx_discrepancy: null,
    night_takeoffs: null,
    approach_precision: null,
    approach_non_precision: null,
    holds: null,
    ifr_actual_minutes: null,
    ifr_simulated_minutes: null,
    ...over,
  };
}

beforeEach(() => {
  // Each test gets fresh action-mock state.
});

describe("SummaryTab", () => {
  it("renders the empty state when there are no legs", () => {
    render(<SummaryTab log={makeLog()} legs={[]} />);
    expect(screen.getByText(/no legs entered yet/i)).toBeInTheDocument();
    expect(screen.getByText(/tab 2 \(legs\)/i)).toBeInTheDocument();
  });

  it("renders three big tiles with totals to one decimal place", () => {
    render(
      <SummaryTab
        log={makeLog()}
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

  it("renders an em dash on tiles when a total can't be computed", () => {
    render(
      <SummaryTab
        log={makeLog()}
        legs={[leg({ engine_on: "08:00:00", engine_off: null })]}
      />,
    );
    // Tiles render "—"; counters input row also has "—" placeholders.
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("renders the counter row with leg / landings / night / fuel totals", () => {
    render(
      <SummaryTab
        log={makeLog()}
        legs={[
          leg({ landings: 1, night_landings: 0, fuel_gallons: 30 }),
          leg({ landings: 2, night_landings: 1, fuel_gallons: 45 }),
        ]}
      />,
    );
    expect(screen.getByText("Legs")).toBeInTheDocument();
    expect(screen.getByText("Landings")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // total landings
    expect(screen.getByText("Night Ldgs")).toBeInTheDocument();
    expect(screen.getByText("Fuel (gal)")).toBeInTheDocument();
    expect(screen.getByText("75.0")).toBeInTheDocument();
  });

  it("renders the derived-from-legs footnote when legs exist", () => {
    render(
      <SummaryTab
        log={makeLog()}
        legs={[leg({ engine_on: "08:00", engine_off: "09:00" })]}
      />,
    );
    expect(screen.getByText(/derived from tab 2/i)).toBeInTheDocument();
  });

  it("renders the pilot-writable currency counters section", () => {
    render(<SummaryTab log={makeLog()} legs={[]} />);
    // The CurrencyCountersField labels each of the six inputs.
    expect(screen.getByText(/pilot entries/i)).toBeInTheDocument();
    // All six fields are reachable via label, which is the user-facing
    // promise of the editable section.
    expect(screen.getByLabelText(/night t\/o/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/appr precision/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/appr non-prec/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^holds$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ifr actual/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ifr simulated/i)).toBeInTheDocument();
  });

  it("pre-fills the currency counter inputs from log values", () => {
    render(
      <SummaryTab
        log={makeLog({
          night_takeoffs: 2,
          approach_precision: 1,
          approach_non_precision: 3,
          holds: 1,
          ifr_actual_minutes: 45,
          ifr_simulated_minutes: 0,
        })}
        legs={[]}
      />,
    );
    const nightTO = screen.getByLabelText(/night t\/o/i) as HTMLInputElement;
    expect(nightTO.value).toBe("2");
    const apchPrec = screen.getByLabelText(/appr precision/i) as HTMLInputElement;
    expect(apchPrec.value).toBe("1");
    const holds = screen.getByLabelText(/^holds$/i) as HTMLInputElement;
    expect(holds.value).toBe("1");
    const ifrActual = screen.getByLabelText(/ifr actual/i) as HTMLInputElement;
    expect(ifrActual.value).toBe("45");
    const ifrSim = screen.getByLabelText(/ifr simulated/i) as HTMLInputElement;
    expect(ifrSim.value).toBe("0");
  });

  it("disables the currency counter inputs in submitted mode", () => {
    render(
      <SummaryTab
        log={makeLog({ status: "submitted" })}
        legs={[]}
      />,
    );
    const nightTO = screen.getByLabelText(/night t\/o/i) as HTMLInputElement;
    expect(nightTO).toBeDisabled();
  });
});
