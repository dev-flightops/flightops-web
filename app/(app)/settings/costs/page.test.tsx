import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, getOperatingCosts: vi.fn(), listFuelTypes: vi.fn(), listAircraft: vi.fn() };
});
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));
vi.mock("@/lib/api/client", () => ({ ApiError: mocks.TestApiError, apiFetch: vi.fn() }));
vi.mock("@/lib/api/auth", () => ({ getOperatingCosts: mocks.getOperatingCosts }));
vi.mock("@/lib/api/ground", () => ({ listFuelTypes: mocks.listFuelTypes }));
vi.mock("@/lib/api/ops", () => ({ listAircraft: mocks.listAircraft }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({
  saveAircraftCostAction: vi.fn(),
  saveFuelPriceAction: vi.fn(),
  saveLandingFeeAction: vi.fn(),
  saveRouteTimeAction: vi.fn(),
  removeCostRowAction: Object.assign(vi.fn(), { bind: () => vi.fn() }),
}));

import SettingsCostsPage from "./page";

function costRow(id: string, type: string, fuel: string | null) {
  return {
    id,
    aircraft_type: type,
    fuel_burn_gph: "58.00",
    fuel_type_code: fuel,
    engine_reserve_hr: null,
    prop_reserve_hr: null,
    maintenance_hr: null,
    oil_consumables_hr: null,
    pilot_daily_rate: null,
    avg_duty_hrs: null,
    insurance_hr: null,
  };
}

beforeEach(() => {
  mocks.getOperatingCosts.mockReset().mockResolvedValue({
    aircraft_costs: [
      costRow("r-1", "Cessna 208B Grand Caravan", "jet_a"),
      costRow("r-2", "Piper PA-31 Navajo", "mogas"),
      costRow("r-3", "Cessna 207", null),
    ],
    fuel_prices: [],
    landing_fees: [],
    routes: [],
  });
  mocks.listFuelTypes.mockReset().mockResolvedValue({ items: [{ code: "JET_A", label: "Jet A" }] });
  mocks.listAircraft.mockReset().mockResolvedValue({
    items: [
      { model: "Cessna 208B Grand Caravan", airframe_type: "caravan" },
      { model: "Cessna 208 Caravan", airframe_type: "caravan" },
      { model: "Piper PA-31 Navajo", airframe_type: null },
      { model: null, airframe_type: null },
    ],
  });
});

function fuelOf(type: string): string | null {
  const cells = within(screen.getByRole("row", { name: new RegExp(`^${type}`) })).getAllByRole("cell");
  return cells[2].textContent;
}

describe("/settings/costs aircraft types (#75)", () => {
  it("shows each type's fuel by the company's name for it", async () => {
    render(await SettingsCostsPage());
    expect(screen.getByRole("columnheader", { name: "Fuel" })).toBeTruthy();
    expect(fuelOf("Cessna 208B Grand Caravan")).toBe("Jet A");
    expect(fuelOf("Piper PA-31 Navajo")).toBe("mogas");
    expect(fuelOf("Cessna 207")).toBe("—");
  });

  it("has a working form to add or edit a type, suggesting the names costing looks types up by", async () => {
    render(await SettingsCostsPage());
    expect(screen.getByText("+ Add / Edit Aircraft Type")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add aircraft type" })).toBeTruthy();
    const suggestions = [...document.querySelectorAll("#aircraft-type-suggestions option")].map((o) =>
      o.getAttribute("value"),
    );
    // Airframe type first, the model when there is none; rows already set up too.
    expect(suggestions).toEqual(["caravan", "Cessna 207", "Cessna 208B Grand Caravan", "Piper PA-31 Navajo"]);
  });

  it("offers no form to someone who can't see the costs", async () => {
    mocks.getOperatingCosts.mockRejectedValue(new mocks.TestApiError(403, "/auth/settings/costs", "forbidden"));
    render(await SettingsCostsPage());
    expect(screen.getByRole("alert").textContent).toBe("Exec Admin role required to view operating cost configuration.");
    expect(screen.queryByRole("button", { name: "Add aircraft type" })).toBeNull();
  });

  it("keeps the page when the fuel types or the fleet can't be had", async () => {
    mocks.listFuelTypes.mockRejectedValue(new Error("down"));
    mocks.listAircraft.mockRejectedValue(new Error("down"));
    render(await SettingsCostsPage());
    expect(fuelOf("Cessna 208B Grand Caravan")).toBe("jet_a");
    expect(screen.getByRole("button", { name: "Add aircraft type" })).toBeTruthy();
  });
});

describe("fuel prices, landing fees and routes (#134)", () => {
  const data = {
    aircraft_costs: [],
    fuel_prices: [{ id: "p-1", icao_code: "PABE", price_per_gal: "7.50", fuel_type: "Jet-A" }],
    landing_fees: [{ id: "l-1", icao_code: "PANC", fee_amount: "50", notes: "Ramp" }],
    routes: [{ id: "t-1", origin_icao: "PABE", dest_icao: "PAEM", est_flight_hrs: "1.2" }],
  };

  beforeEach(() => {
    mocks.listFuelTypes.mockResolvedValue({ items: [] });
    mocks.listAircraft.mockResolvedValue({ items: [] });
  });

  it("has a working form for each, with nothing disabled and no developer notes", async () => {
    mocks.getOperatingCosts.mockResolvedValue(data);
    const { container } = render(await SettingsCostsPage());
    for (const name of ["Add or edit a fuel price", "Add or edit a landing fee", "Add or edit a route"]) {
      expect(within(screen.getByRole("form", { name, hidden: true })).getByRole("button", { name: "Save", hidden: true })).toBeEnabled();
    }
    expect(container.querySelector('[aria-disabled="true"], [disabled]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/follow-up|endpoints/);
  });

  it("gives every row a Remove", async () => {
    mocks.getOperatingCosts.mockResolvedValue(data);
    render(await SettingsCostsPage());
    expect(screen.getByRole("button", { name: "Remove the Jet-A price at PABE" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove the landing fee at PANC" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove the route PABE to PAEM" })).toBeEnabled();
  });

  it("offers neither when the page couldn't load", async () => {
    mocks.getOperatingCosts.mockRejectedValue(new mocks.TestApiError(403, "/x", "forbidden"));
    render(await SettingsCostsPage());
    expect(screen.queryByRole("form", { name: "Add or edit a route", hidden: true })).not.toBeInTheDocument();
  });
});
