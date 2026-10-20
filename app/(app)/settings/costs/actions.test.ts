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
  return { TestApiError, upsertAircraftCost: vi.fn(), revalidatePath: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: api.TestApiError }));
vi.mock("@/lib/api/auth", () => ({ upsertAircraftCost: api.upsertAircraftCost }));
vi.mock("next/cache", () => ({ revalidatePath: api.revalidatePath }));

import { saveAircraftCostAction } from "./actions";

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
