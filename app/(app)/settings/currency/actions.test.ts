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
    createCurrencyItem: vi.fn(),
    updateCurrencyItem: vi.fn(),
    deactivateCurrencyItem: vi.fn(),
    revalidatePath: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: api.TestApiError }));
vi.mock("@/lib/api/ops", () => ({
  createCurrencyItem: api.createCurrencyItem,
  updateCurrencyItem: api.updateCurrencyItem,
  deactivateCurrencyItem: api.deactivateCurrencyItem,
}));
vi.mock("@/lib/api/type-qualifications", () => ({
  updateComplianceSettings: vi.fn(),
  updateFirstClassMedicalTypes: vi.fn(),
  updateNotStartedBlocks: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: api.revalidatePath }));

import { addCustomItemAction, renameCustomItemAction, setCustomItemActiveAction } from "./actions";

const IDLE = { status: "idle" as const, attempt: 0 };

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const fields = (over: Record<string, string> = {}) =>
  form({ name: "YK Delta Route Authorization", regulation: "Company GOM 4.2", interval_type: "annual", ...over });

beforeEach(() => vi.clearAllMocks());

describe("addCustomItemAction (#134)", () => {
  it("makes the code from the name, as the defaults' codes read", async () => {
    api.createCurrencyItem.mockResolvedValue({});
    const state = await addCustomItemAction(IDLE, fields());
    expect(api.createCurrencyItem).toHaveBeenCalledWith({
      code: "yk_delta_route_authorization",
      name: "YK Delta Route Authorization",
      regulation: "Company GOM 4.2",
      interval_type: "annual",
      is_check_event: false,
      requires_examiner: false,
      is_initial_only: false,
    });
    expect(state.message).toBe("Added YK Delta Route Authorization.");
    expect(api.revalidatePath).toHaveBeenCalledWith("/compliance/crew-currency");
  });

  it("sends the window and the ticks for a rolling check", async () => {
    api.createCurrencyItem.mockResolvedValue({});
    await addCustomItemAction(
      IDLE,
      fields({ interval_type: "rolling_days", rolling_days: "90", rolling_threshold: "3", is_check_event: "on" }),
    );
    expect(api.createCurrencyItem).toHaveBeenCalledWith(
      expect.objectContaining({ rolling_days: 90, rolling_threshold: 3, is_check_event: true }),
    );
  });

  it.each([
    [{ name: " " }, /item's name/],
    [{ name: "!!!" }, /letters or numbers/],
    [{ regulation: "" }, /what requires it/],
    [{ interval_type: "medical_hard_expiry" }, /how often/],
    [{ interval_type: "rolling_days", rolling_days: "0", rolling_threshold: "3" }, /window in days/],
    [{ interval_type: "rolling_days", rolling_days: "90", rolling_threshold: "" }, /how many/],
  ])("refuses %j before asking the API", async (over, message) => {
    const state = await addCustomItemAction(IDLE, fields(over));
    expect(state.message).toMatch(message);
    expect(api.createCurrencyItem).not.toHaveBeenCalled();
  });

  it("says when the name is taken", async () => {
    api.createCurrencyItem.mockRejectedValue(new api.TestApiError(409, "/x", "currency_item_code_taken: 'x'"));
    const state = await addCustomItemAction(IDLE, fields());
    expect(state.message).toBe("There is already a custom item with that name.");
  });
});

describe("changing an item (#134)", () => {
  it("renames, trimmed", async () => {
    await expect(renameCustomItemAction("c-1", " Fire Drill ", " GOM 4.2 ")).resolves.toEqual({ ok: true });
    expect(api.updateCurrencyItem).toHaveBeenCalledWith("c-1", { name: "Fire Drill", regulation: "GOM 4.2" });
  });

  it("won't blank a name or reference", async () => {
    await expect(renameCustomItemAction("c-1", "", "GOM")).resolves.toMatchObject({ ok: false });
    await expect(renameCustomItemAction("c-1", "Drill", " ")).resolves.toMatchObject({ ok: false });
    expect(api.updateCurrencyItem).not.toHaveBeenCalled();
  });

  it("deactivates by the delete route and brings back by the update route", async () => {
    await setCustomItemActiveAction("c-1", false);
    expect(api.deactivateCurrencyItem).toHaveBeenCalledWith("c-1");
    await setCustomItemActiveAction("c-1", true);
    expect(api.updateCurrencyItem).toHaveBeenCalledWith("c-1", { is_active: true });
  });
});
