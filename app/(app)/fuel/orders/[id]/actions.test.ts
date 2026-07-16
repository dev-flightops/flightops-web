import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  confirmFuelOrder,
  markFuelOrderFueled,
  cancelFuelOrder,
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
    confirmFuelOrder: vi.fn(),
    markFuelOrderFueled: vi.fn(),
    cancelFuelOrder: vi.fn(),
    revalidatePath: vi.fn(),
    TestApiError,
  };
});

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api/ground", () => ({
  confirmFuelOrder,
  markFuelOrderFueled,
  cancelFuelOrder,
}));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));

import { confirmOrderAction } from "./actions";

const ORDER_ID = "96cb78e2-37f2-4809-bbb0-7e4c6c86896d";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

beforeEach(() => {
  confirmFuelOrder.mockReset();
  markFuelOrderFueled.mockReset();
  cancelFuelOrder.mockReset();
  revalidatePath.mockReset();
});

describe("confirmOrderAction — error mapping (M2-C-4)", () => {
  it("says 'supplier already confirmed' when backend 409s with detail citing 'confirmed'", async () => {
    confirmFuelOrder.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ground/fuel/orders/x/confirm",
        JSON.stringify({
          detail:
            "cannot confirm an order in status 'confirmed'; only 'ordered' orders confirm",
        }),
      ),
    );
    const state = await confirmOrderAction(
      { status: "idle" },
      fd({ order_id: ORDER_ID, confirmed_by_name: "Greg" }),
    );
    expect(state).toEqual({
      status: "api-error",
      message: expect.stringMatching(/supplier already confirmed/i),
    });
  });

  it("says 'this order is closed' when 409 cites 'fueled' or 'cancelled'", async () => {
    confirmFuelOrder.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ground/fuel/orders/x/confirm",
        JSON.stringify({
          detail:
            "cannot confirm an order in status 'fueled'; only 'ordered' orders confirm",
        }),
      ),
    );
    const state = await confirmOrderAction(
      { status: "idle" },
      fd({ order_id: ORDER_ID, confirmed_by_name: "Greg" }),
    );
    expect(state).toEqual({
      status: "api-error",
      message: expect.stringMatching(/closed and can't be changed/i),
    });
  });

  it("surfaces the first field error on 422 instead of a generic HTTP 422", async () => {
    confirmFuelOrder.mockRejectedValueOnce(
      new TestApiError(
        422,
        "/ground/fuel/orders/x/confirm",
        JSON.stringify({
          detail: [
            {
              type: "string_too_short",
              loc: ["body", "confirmed_by_name"],
              msg: "String should have at least 1 character",
            },
          ],
        }),
      ),
    );
    const state = await confirmOrderAction(
      { status: "idle" },
      fd({ order_id: ORDER_ID, confirmed_by_name: "x" }),
    );
    expect(state).toEqual({
      status: "api-error",
      message: expect.stringMatching(
        /confirmed_by_name.*at least 1 character/i,
      ),
    });
  });

  it("returns friendly session-expired message on 401", async () => {
    confirmFuelOrder.mockRejectedValueOnce(
      new TestApiError(
        401,
        "/ground/fuel/orders/x/confirm",
        JSON.stringify({ detail: "invalid_token" }),
      ),
    );
    const state = await confirmOrderAction(
      { status: "idle" },
      fd({ order_id: ORDER_ID, confirmed_by_name: "Greg" }),
    );
    expect(state).toEqual({
      status: "api-error",
      message: expect.stringMatching(/session expired/i),
    });
  });

  it("returns 'order not found' on 404", async () => {
    confirmFuelOrder.mockRejectedValueOnce(
      new TestApiError(
        404,
        "/ground/fuel/orders/x/confirm",
        JSON.stringify({ detail: "fuel_order_not_found" }),
      ),
    );
    const state = await confirmOrderAction(
      { status: "idle" },
      fd({ order_id: ORDER_ID, confirmed_by_name: "Greg" }),
    );
    expect(state).toEqual({
      status: "api-error",
      message: expect.stringMatching(/order not found/i),
    });
  });

  it("returns ok on 200 and revalidates the order page", async () => {
    confirmFuelOrder.mockResolvedValueOnce({});
    const state = await confirmOrderAction(
      { status: "idle" },
      fd({
        order_id: ORDER_ID,
        confirmed_by_name: "Greg",
        confirmed_note: "note",
      }),
    );
    expect(state).toEqual({ status: "ok" });
    expect(revalidatePath).toHaveBeenCalledWith(`/fuel/orders/${ORDER_ID}`);
  });

  it("returns field errors on empty name (zod catches before the API call)", async () => {
    const state = await confirmOrderAction(
      { status: "idle" },
      fd({ order_id: ORDER_ID, confirmed_by_name: "" }),
    );
    expect(state).toEqual({
      status: "field-errors",
      errors: { confirmed_by_name: "Name is required" },
    });
    expect(confirmFuelOrder).not.toHaveBeenCalled();
  });
});
