import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createCurrencyItem,
  deactivateCurrencyItem,
  revalidatePath,
  TestApiError,
} = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  }
  return {
    createCurrencyItem: vi.fn(),
    deactivateCurrencyItem: vi.fn(),
    revalidatePath: vi.fn(),
    TestApiError,
  };
});

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api/ops", () => ({
  createCurrencyItem,
  deactivateCurrencyItem,
}));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));

import {
  createCurrencyItemAction,
  deactivateCurrencyItemAction,
} from "./add-currency-item-actions";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

beforeEach(() => {
  createCurrencyItem.mockReset();
  deactivateCurrencyItem.mockReset();
  revalidatePath.mockReset();
});

describe("createCurrencyItemAction (M2-C-2)", () => {
  it("sends the payload and revalidates on success (annual, no rolling fields)", async () => {
    createCurrencyItem.mockResolvedValueOnce({ id: "x" });
    const state = await createCurrencyItemAction(
      { status: "idle" },
      fd({
        code: "co_fire_drill",
        name: "Fire Drill",
        regulation: "Company Policy",
        interval_type: "annual",
      }),
    );
    expect(state).toEqual({ status: "ok" });
    expect(createCurrencyItem).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "co_fire_drill",
        interval_type: "annual",
        rolling_days: null,
        rolling_threshold: null,
        requires_examiner: false,
        is_check_event: false,
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/compliance/crew-currency");
  });

  it("passes rolling_days + threshold only for rolling_days interval", async () => {
    createCurrencyItem.mockResolvedValueOnce({ id: "x" });
    await createCurrencyItemAction(
      { status: "idle" },
      fd({
        code: "co_ifr_touch_up",
        name: "IFR Touch-Up",
        regulation: "Company Policy",
        interval_type: "rolling_days",
        rolling_days: "180",
        rolling_threshold: "6",
      }),
    );
    expect(createCurrencyItem).toHaveBeenCalledWith(
      expect.objectContaining({
        rolling_days: 180,
        rolling_threshold: 6,
      }),
    );
  });

  it("returns field-errors when rolling_days interval is missing threshold", async () => {
    const state = await createCurrencyItemAction(
      { status: "idle" },
      fd({
        code: "co_test",
        name: "Test",
        regulation: "Policy",
        interval_type: "rolling_days",
        rolling_days: "180",
      }),
    );
    expect(state.status).toBe("field-errors");
    expect((state as { errors: Record<string, string> }).errors).toHaveProperty(
      "rolling_days",
    );
    expect(createCurrencyItem).not.toHaveBeenCalled();
  });

  it("returns field-errors on invalid code characters", async () => {
    const state = await createCurrencyItemAction(
      { status: "idle" },
      fd({
        code: "co fire!",
        name: "Fire",
        regulation: "Policy",
        interval_type: "annual",
      }),
    );
    expect(state.status).toBe("field-errors");
    expect((state as { errors: Record<string, string> }).errors.code).toMatch(
      /letters, digits/i,
    );
  });

  it("maps a backend 409 into a duplicate-code field error", async () => {
    createCurrencyItem.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/currency-items",
        JSON.stringify({ detail: "currency_item_code_taken: 'co_fire'" }),
      ),
    );
    const state = await createCurrencyItemAction(
      { status: "idle" },
      fd({
        code: "co_fire",
        name: "Fire",
        regulation: "Policy",
        interval_type: "annual",
      }),
    );
    expect(state.status).toBe("field-errors");
    expect((state as { errors: Record<string, string> }).errors.code).toMatch(
      /already in use/i,
    );
  });

  it("maps a backend 403 into a role-message api-error", async () => {
    createCurrencyItem.mockRejectedValueOnce(
      new TestApiError(
        403,
        "/ops/currency-items",
        JSON.stringify({ detail: "forbidden" }),
      ),
    );
    const state = await createCurrencyItemAction(
      { status: "idle" },
      fd({
        code: "co_fire",
        name: "Fire",
        regulation: "Policy",
        interval_type: "annual",
      }),
    );
    expect(state).toEqual({
      status: "api-error",
      message: expect.stringMatching(/Chief Pilot|Exec Admin/i),
    });
  });
});

describe("deactivateCurrencyItemAction (M2-C-2)", () => {
  it("returns ok and revalidates on success", async () => {
    deactivateCurrencyItem.mockResolvedValueOnce({ id: "x", is_active: false });
    const state = await deactivateCurrencyItemAction("some-id");
    expect(state).toEqual({ status: "ok" });
    expect(revalidatePath).toHaveBeenCalledWith("/compliance/crew-currency");
  });

  it("maps 403 to a friendly default-protected message", async () => {
    deactivateCurrencyItem.mockRejectedValueOnce(
      new TestApiError(
        403,
        "/ops/currency-items/x",
        JSON.stringify({ detail: "cannot_mutate_default_currency_item" }),
      ),
    );
    const state = await deactivateCurrencyItemAction("some-id");
    expect(state).toEqual({
      status: "error",
      message: expect.stringMatching(/default Part 135/i),
    });
  });
});
