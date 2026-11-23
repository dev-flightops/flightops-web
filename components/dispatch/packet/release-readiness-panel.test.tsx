import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/frat/frat-signoffs", () => ({ FratSignoffs: () => null }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {}, apiFetch: vi.fn() }));
// The manifest's fuel form keeps its state with useActionState, which this
// test runner's React lacks: a stand-in shows what it was given.
vi.mock("@/app/(app)/manifest/[flightId]/fuel-form", () => ({
  PlannedFuelForm: ({ flightId, current }: { flightId: string; current: string | null }) => (
    <form aria-label="Plan the fuel" data-flight={flightId}>
      <label>
        Planned fuel (lb)
        <input defaultValue={current ?? ""} />
      </label>
    </form>
  ),
}));

import type { FlightLoad, LegLoad } from "@/lib/api/manifest";
import type { FlightDetail } from "@/lib/api/types";

import { ReleaseReadinessPanel } from "./release-readiness-panel";

const FLIGHT = {
  id: "f-1",
  flight_number: "BK-0BD901C6",
  is_ifr: false,
  aircraft: { id: "a-1", tail_number: "N503PA", model: "Cessna 208B Grand Caravan", seats: 9 },
} as unknown as FlightDetail;

const leg = (origin: string, destination: string, fuel: string, left: string): LegLoad => ({
  origin,
  destination,
  pax_count: 1,
  pax_weight_lbs: "120.0",
  baggage_lbs: "0",
  cargo_lbs: "0",
  mail_lbs: "0",
  payload_lbs: "120.0",
  fuel_lbs: fuel,
  remaining_lbs: left,
});

// BK-0BD901C6 on the demo, 18 Nov: Bethel to Mountain Village and back.
const LOAD: FlightLoad = {
  flight_id: "f-1",
  has_manifest: true,
  booked_passengers: 1,
  checked_in: { count: 0, weight_lbs: "0", baggage_lbs: "0" },
  to_check_in: { count: 1, weight_lbs: "120.0", baggage_lbs: "0" },
  cargo_lbs: "0",
  load: {
    useful_load_lbs: 4036,
    max_gross_weight_lbs: 9062,
    empty_weight_lbs: 5026,
    crew_lbs: "190",
    crew_basis: "standard",
    crew_count: 1,
    fuel_lbs: "908",
    payload_lbs: "120.0",
    remaining_lbs: "2818.0",
    fuel_counted: true,
    fuel_basis: "estimated",
    fuel_estimate: {
      lbs: "908",
      gallons: "135.4",
      burn_gph: "58.00",
      fuel_type_code: "jet_a",
      flight_minutes: 95,
      round_trip: false,
      reserve_minutes: 45,
      missing: [],
    },
    by_leg: [leg("PABE", "PAMO", "908", "2818.0"), leg("PAMO", "PABE", "649", "3077.0")],
    leg: "PABE → PAMO",
    leg_fuel_burned: true,
  },
  release: { basis: "manifest", useful_load_lbs: 4036, payload_lbs: "120.0", remaining_lbs: "2818.0" },
};

function renderPanel(load: FlightLoad, canPlanFuel = true) {
  return render(
    <ReleaseReadinessPanel
      flight={FLIGHT}
      frat={null}
      fratUnavailable={false}
      load={load}
      timeZone="America/Anchorage"
      canSignForDispatch
      canPlanFuel={canPlanFuel}
    />,
  );
}

describe("the packet's weight and balance (client, 18 Nov)", () => {
  it("shows the fuel at departure and each leg, the way back leaving with less", () => {
    renderPanel(LOAD);
    const fuel = screen.getByText("Fuel at departure").closest("p");
    expect(fuel).toHaveTextContent("908 lb, estimated");
    expect(screen.getByText(/^Fuel estimated: 1 h 35 min as scheduled/)).toBeInTheDocument();
    expect(
      screen.getByText("The figures above are the tightest leg’s, PABE → PAMO. Each leg after the first leaves with less fuel:"),
    ).toBeInTheDocument();
    const legs = screen.getByRole("region", { name: "Load by leg" });
    expect(within(legs).getByRole("row", { name: /PABE → PAMO/ })).toHaveTextContent("2,818");
    const back = within(legs).getByRole("row", { name: /PAMO → PABE/ });
    expect(back).toHaveTextContent("649");
    expect(back).toHaveTextContent("3,077");
  });

  it("plans the fuel here, starting from the figure planned", () => {
    renderPanel({
      ...LOAD,
      load: {
        ...LOAD.load,
        fuel_basis: "planned",
        fuel_lbs: "1200",
        by_leg: [leg("PABE", "PAMO", "1200", "2526.0"), leg("PAMO", "PABE", "941", "2785.0")],
      },
    });
    expect(screen.getByText("Fuel at departure").closest("p")).toHaveTextContent("1,200 lb, planned");
    expect(screen.getByLabelText("Planned fuel (lb)")).toHaveValue("1200");
  });

  it("starts the fuel box afresh when another flight is picked (Codex, #496)", async () => {
    const user = userEvent.setup();
    const { rerender } = renderPanel(LOAD);
    await user.type(screen.getByLabelText("Planned fuel (lb)"), "1500");
    const other = { ...FLIGHT, id: "f-2" } as FlightDetail;
    rerender(
      <ReleaseReadinessPanel
        flight={other}
        frat={null}
        fratUnavailable={false}
        load={{ ...LOAD, flight_id: "f-2" }}
        timeZone="America/Anchorage"
        canSignForDispatch
        canPlanFuel
      />,
    );
    expect(screen.getByLabelText("Planned fuel (lb)")).toHaveValue("");
    expect(screen.getByRole("form", { name: "Plan the fuel" })).toHaveAttribute("data-flight", "f-2");
  });

  it("points to the manifest when there isn't one to plan the fuel on", () => {
    renderPanel({ ...LOAD, has_manifest: false });
    expect(screen.queryByLabelText("Planned fuel (lb)")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the manifest ›" })).toHaveAttribute("href", "/manifest/f-1");
  });

  it("has no fuel form for a viewer who can't plan it", () => {
    renderPanel(LOAD, false);
    expect(screen.queryByLabelText("Planned fuel (lb)")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open the manifest ›" })).not.toBeInTheDocument();
  });

  it("shows no legs for a one-leg flight", () => {
    renderPanel({ ...LOAD, load: { ...LOAD.load, by_leg: [], leg: null } });
    expect(screen.queryByRole("region", { name: "Load by leg" })).not.toBeInTheDocument();
    expect(screen.getByText("Fuel at departure").closest("p")).toHaveTextContent("908 lb, estimated");
  });
});
