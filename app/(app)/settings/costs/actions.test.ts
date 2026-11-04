import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    TestApiError,
    upsertAircraftCost: vi.fn(),
    saveFuelPrice: vi.fn(),
    saveLandingFee: vi.fn(),
    saveRouteTime: vi.fn(),
    deleteCostRow: vi.fn(),
    revalidatePath: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: api.TestApiError }));
vi.mock("@/lib/api/auth", () => ({
  upsertAircraftCost: api.upsertAircraftCost,
  saveFuelPrice: api.saveFuelPrice,
  saveLandingFee: api.saveLandingFee,
  saveRouteTime: api.saveRouteTime,
  deleteCostRow: api.deleteCostRow,
}));
vi.mock("next/cache", () => ({ revalidatePath: api.revalidatePath }));

import {
  removeCostRowAction,
  saveAircraftCostAction,
  saveFuelPriceAction,
  saveLandingFeeAction,
  saveRouteTimeAction,
} from "./actions";

const IDLE = { status: "idle" as const, attempt: 0 };

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const row = (over: Record<string, string> = {}) =>
  form({
    aircraft_type: " Cessna 208B Grand Caravan ",
    fuel_type_code: "jet_a",
    fuel_burn_gph: "58",
    engine_reserve_hr: "$175",
    prop_reserve_hr: "25",
    maintenance_hr: "1,100",
    oil_consumables_hr: "",
    pilot_daily_rate: "350",
    avg_duty_hrs: "8",
    insurance_hr: "",
    ...over,
  });

beforeEach(() => {
  api.upsertAircraftCost.mockReset().mockResolvedValue({});
  api.revalidatePath.mockReset();
});

describe("saveAircraftCostAction (#75)", () => {
  it("sends every figure, blanks as cleared, dollar signs and commas dropped", async () => {
    const state = await saveAircraftCostAction(IDLE, row());
    expect(api.upsertAircraftCost).toHaveBeenCalledWith({
      aircraft_type: "Cessna 208B Grand Caravan",
      fuel_type_code: "jet_a",
      fuel_burn_gph: "58",
      engine_reserve_hr: "175",
      prop_reserve_hr: "25",
      maintenance_hr: "1100",
      oil_consumables_hr: null,
      pilot_daily_rate: "350",
      avg_duty_hrs: "8",
      insurance_hr: null,
    });
    expect(state).toEqual({ status: "ok", message: "Saved Cessna 208B Grand Caravan.", attempt: 1 });
    expect(api.revalidatePath).toHaveBeenCalledWith("/settings/costs");
  });

  it("clears the fuel when Not set is picked", async () => {
    await saveAircraftCostAction(IDLE, row({ fuel_type_code: "" }));
    expect(api.upsertAircraftCost).toHaveBeenCalledWith(expect.objectContaining({ fuel_type_code: null }));
  });

  it.each([
    ["no type", { aircraft_type: "  " }, "Enter the aircraft type."],
    ["a negative burn", { fuel_burn_gph: "-5" }, "Enter numbers of 0 or more."],
    ["a burn in words", { fuel_burn_gph: "lots" }, "Enter numbers of 0 or more."],
  ])("refuses %s before it reaches the API", async (_label, over, message) => {
    const state = await saveAircraftCostAction(IDLE, row(over));
    expect(api.upsertAircraftCost).not.toHaveBeenCalled();
    expect(state).toMatchObject({ status: "error", message });
  });

  it.each([
    [403, "forbidden", "Only an Exec Admin can change operating costs."],
    [422, '{"detail":"unknown_fuel_type"}', "That fuel isn't one of the company's fuel types."],
    [500, "boom", "That was not saved (HTTP 500)."],
  ])("explains a %i", async (status, body, message) => {
    api.upsertAircraftCost.mockRejectedValue(new api.TestApiError(status, "/auth/settings/costs", body));
    expect((await saveAircraftCostAction(IDLE, row())).message).toBe(message);
    expect(api.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("fuel prices, landing fees and routes (#134)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves a fuel price, the code upper-cased", async () => {
    api.saveFuelPrice.mockResolvedValue({});
    const state = await saveFuelPriceAction(IDLE, form({ icao_code: " pabe ", price_per_gal: "$7.50", fuel_type: "Jet-A" }));
    expect(api.saveFuelPrice).toHaveBeenCalledWith({ icao_code: "PABE", price_per_gal: "7.50", fuel_type: "Jet-A" });
    expect(state).toMatchObject({ status: "ok", message: "Saved Jet-A at PABE." });
    expect(api.revalidatePath).toHaveBeenCalledWith("/settings/costs");
  });

  it("takes a village's FAA code", async () => {
    api.saveFuelPrice.mockResolvedValue({});
    await saveFuelPriceAction(IDLE, form({ icao_code: "9z8", price_per_gal: "8", fuel_type: "100LL" }));
    expect(api.saveFuelPrice).toHaveBeenCalledWith(expect.objectContaining({ icao_code: "9Z8" }));
  });

  it.each([
    [{ icao_code: "PA", price_per_gal: "7", fuel_type: "Jet-A" }, /airport code/],
    [{ icao_code: "PABE", price_per_gal: "0", fuel_type: "Jet-A" }, /above \$0/],
    [{ icao_code: "PABE", price_per_gal: "7", fuel_type: "" }, /Pick the fuel/],
  ])("refuses the fuel price %j", async (fields, message) => {
    const state = await saveFuelPriceAction(IDLE, form(fields));
    expect(state.message).toMatch(message);
    expect(api.saveFuelPrice).not.toHaveBeenCalled();
  });

  it("saves a landing fee, 0 included, with blank notes as null", async () => {
    api.saveLandingFee.mockResolvedValue({});
    await saveLandingFeeAction(IDLE, form({ icao_code: "panc", fee_amount: "0", notes: " " }));
    expect(api.saveLandingFee).toHaveBeenCalledWith({ icao_code: "PANC", fee_amount: "0", notes: null });
  });

  it("refuses a fee that isn't a number", async () => {
    const state = await saveLandingFeeAction(IDLE, form({ icao_code: "PANC", fee_amount: "free" }));
    expect(state.message).toMatch(/in dollars/);
  });

  it("saves a route", async () => {
    api.saveRouteTime.mockResolvedValue({});
    const state = await saveRouteTimeAction(IDLE, form({ origin_icao: "pabe", dest_icao: "paem", est_flight_hrs: "1.2" }));
    expect(api.saveRouteTime).toHaveBeenCalledWith({ origin_icao: "PABE", dest_icao: "PAEM", est_flight_hrs: "1.2" });
    expect(state.message).toBe("Saved PABE to PAEM.");
  });

  it("refuses a route with no time", async () => {
    const state = await saveRouteTimeAction(IDLE, form({ origin_icao: "PABE", dest_icao: "PAEM", est_flight_hrs: "0" }));
    expect(state.message).toMatch(/flight time/);
  });

  it("removes a row by its kind", async () => {
    api.deleteCostRow.mockResolvedValue(undefined);
    await expect(removeCostRowAction("landing-fee", "f-1")).resolves.toEqual({ ok: true });
    expect(api.deleteCostRow).toHaveBeenCalledWith("landing-fee", "f-1");
  });

  it("says who may remove one", async () => {
    api.deleteCostRow.mockRejectedValue(new api.TestApiError(403, "/x", "forbidden"));
    await expect(removeCostRowAction("route", "r-1")).resolves.toEqual({
      ok: false,
      error: "Only an Exec Admin can change operating costs.",
    });
  });
});
