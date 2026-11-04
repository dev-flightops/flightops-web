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
    createPayRate: vi.fn(),
    createPayModifier: vi.fn(),
    deletePayRate: vi.fn(),
    deletePayModifier: vi.fn(),
    revalidatePath: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: api.TestApiError }));
vi.mock("@/lib/api/auth", () => ({
  createPayRate: api.createPayRate,
  createPayModifier: api.createPayModifier,
  deletePayRate: api.deletePayRate,
  deletePayModifier: api.deletePayModifier,
}));
vi.mock("next/cache", () => ({ revalidatePath: api.revalidatePath }));

import { addPayModifierAction, addPayRateAction, removePayModifierAction, removePayRateAction } from "./actions";

const IDLE = { status: "idle" as const, attempt: 0 };

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const rate = (over: Record<string, string> = {}) =>
  form({ rate_type: "daily", rate_amount: "350", effective_date: "2026-11-04", ...over });

const modifier = (over: Record<string, string> = {}) =>
  form({ modifier_name: "medevac", display_label: "Medevac Premium", modifier_type: "flat", modifier_value: "150", ...over });

beforeEach(() => vi.clearAllMocks());

describe("addPayRateAction (#134)", () => {
  it("sends the rate, blank fields as null", async () => {
    api.createPayRate.mockResolvedValue({});
    const state = await addPayRateAction(IDLE, rate({ airframe_type: " caravan ", year_of_service_max: "5" }));
    expect(api.createPayRate).toHaveBeenCalledWith({
      rate_type: "daily",
      crew_member_id: null,
      airframe_type: "caravan",
      year_of_service_min: null,
      year_of_service_max: 5,
      rate_amount: "350",
      effective_date: "2026-11-04",
      end_date: null,
    });
    expect(state).toMatchObject({ status: "ok", attempt: 1 });
    expect(api.revalidatePath).toHaveBeenCalledWith("/settings/pilot-pay");
  });

  it.each([
    [{ rate_type: "weekly" }, /type of rate/],
    [{ rate_amount: "0" }, /above \$0/],
    [{ rate_amount: "lots" }, /above \$0/],
    [{ effective_date: "" }, /takes effect/],
    [{ year_of_service_min: "1.5" }, /whole numbers/],
  ])("refuses %j before asking the API", async (over, message) => {
    const state = await addPayRateAction(IDLE, rate(over));
    expect(state.status).toBe("error");
    expect(state.message).toMatch(message);
    expect(api.createPayRate).not.toHaveBeenCalled();
  });

  it.each([
    ["yos_min_gt_max", 422, /YOS Min/],
    ["end_before_effective", 422, /end date/],
    ["forbidden", 403, /Exec Admin/],
    ["expired", 401, /session expired/],
  ])("says what the API's %s means", async (code, status, message) => {
    api.createPayRate.mockRejectedValue(new api.TestApiError(status, "/x", code));
    const state = await addPayRateAction(IDLE, rate());
    expect(state.status).toBe("error");
    expect(state.message).toMatch(message);
    expect(api.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("addPayModifierAction (#134)", () => {
  it("sends the modifier", async () => {
    api.createPayModifier.mockResolvedValue({});
    const state = await addPayModifierAction(IDLE, modifier({ modifier_value: "$1,500.50" }));
    expect(api.createPayModifier).toHaveBeenCalledWith({
      modifier_name: "medevac",
      display_label: "Medevac Premium",
      modifier_type: "flat",
      modifier_value: "1500.50",
    });
    expect(state.message).toBe("Added Medevac Premium.");
  });

  it.each([
    [{ display_label: " " }, /label/],
    [{ modifier_type: "bonus" }, /type of modifier/],
    [{ modifier_value: "" }, /as a number/],
  ])("refuses %j", async (over, message) => {
    const state = await addPayModifierAction(IDLE, modifier(over));
    expect(state.message).toMatch(message);
    expect(api.createPayModifier).not.toHaveBeenCalled();
  });
});

describe("removing a row (#134)", () => {
  it("removes a rate and a modifier", async () => {
    await expect(removePayRateAction("r-1")).resolves.toEqual({ ok: true });
    await expect(removePayModifierAction("m-1")).resolves.toEqual({ ok: true });
    expect(api.deletePayRate).toHaveBeenCalledWith("r-1");
    expect(api.deletePayModifier).toHaveBeenCalledWith("m-1");
  });

  it("says when it's already gone", async () => {
    api.deletePayRate.mockRejectedValue(new api.TestApiError(404, "/x", "pay_rate_not_found"));
    await expect(removePayRateAction("r-1")).resolves.toEqual({
      ok: false,
      error: "That row is already gone. Refresh the page.",
    });
  });
});
