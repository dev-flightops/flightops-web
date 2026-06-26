import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  acknowledgeSupplierFuelOrder,
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
    }
  }
  return {
    acknowledgeSupplierFuelOrder: vi.fn(),
    revalidatePath: vi.fn(),
    TestApiError,
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ acknowledgeSupplierFuelOrder }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { acknowledgeOrderAction } from "./acknowledge-action";

beforeEach(() => {
  acknowledgeSupplierFuelOrder.mockReset();
  revalidatePath.mockClear();
});

describe("acknowledgeOrderAction", () => {
  it("POSTs the trimmed name + note and revalidates the inbox", async () => {
    acknowledgeSupplierFuelOrder.mockResolvedValueOnce({ id: "o-1" });
    const result = await acknowledgeOrderAction(
      "o-1",
      "  Sarah  ",
      "  Truck en route  ",
    );
    expect(result.status).toBe("ok");
    expect(acknowledgeSupplierFuelOrder).toHaveBeenCalledWith(
      "o-1",
      "Sarah",
      "Truck en route",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/fuel/supplier");
  });

  it("forwards null note when only whitespace is supplied", async () => {
    acknowledgeSupplierFuelOrder.mockResolvedValueOnce({ id: "o-1" });
    await acknowledgeOrderAction("o-1", "Sarah", "   ");
    expect(acknowledgeSupplierFuelOrder).toHaveBeenCalledWith(
      "o-1",
      "Sarah",
      null,
    );
  });

  it("returns an error without firing the API when name is blank", async () => {
    const result = await acknowledgeOrderAction("o-1", "   ", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/who's acknowledging/i);
    }
    expect(acknowledgeSupplierFuelOrder).not.toHaveBeenCalled();
  });

  it("maps 403 to the not-a-supplier hint", async () => {
    acknowledgeSupplierFuelOrder.mockRejectedValueOnce(
      new TestApiError(403, "/x", JSON.stringify({ detail: "x" })),
    );
    const result = await acknowledgeOrderAction("o-1", "Sarah", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/bound to a supplier/i);
    }
  });

  it("maps 409 to the already-acknowledged explainer", async () => {
    acknowledgeSupplierFuelOrder.mockRejectedValueOnce(
      new TestApiError(409, "/x", JSON.stringify({ detail: "x" })),
    );
    const result = await acknowledgeOrderAction("o-1", "Sarah", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/already been acknowledged/i);
    }
  });

  it("maps 404 to the order-gone explainer", async () => {
    acknowledgeSupplierFuelOrder.mockRejectedValueOnce(
      new TestApiError(404, "/x", JSON.stringify({ detail: "x" })),
    );
    const result = await acknowledgeOrderAction("o-1", "Sarah", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/order not found/i);
    }
  });

  it("maps 401 to session-expired", async () => {
    acknowledgeSupplierFuelOrder.mockRejectedValueOnce(
      new TestApiError(401, "/x", "Unauthorized"),
    );
    const result = await acknowledgeOrderAction("o-1", "Sarah", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/session expired/i);
    }
  });
});
