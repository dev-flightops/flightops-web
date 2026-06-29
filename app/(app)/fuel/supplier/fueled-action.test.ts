import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  markSupplierFuelOrderFueled,
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
    markSupplierFuelOrderFueled: vi.fn(),
    revalidatePath: vi.fn(),
    TestApiError,
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ markSupplierFuelOrderFueled }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { markFueledAction } from "./fueled-action";

beforeEach(() => {
  markSupplierFuelOrderFueled.mockReset();
  revalidatePath.mockClear();
});

describe("markFueledAction", () => {
  it("POSTs trimmed inputs and reports fueled when backend returns 'fueled'", async () => {
    markSupplierFuelOrderFueled.mockResolvedValueOnce({
      id: "o-1",
      status: "fueled",
    });
    const result = await markFueledAction("o-1", "  Sarah  ", "100", "");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.resulting_status).toBe("fueled");
    }
    expect(markSupplierFuelOrderFueled).toHaveBeenCalledWith("o-1", {
      fueled_by_name: "Sarah",
      actual_quantity_gallons: 100,
      discrepancy_reason: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/fuel/supplier");
  });

  it("reports discrepancy when the backend auto-flipped the status", async () => {
    markSupplierFuelOrderFueled.mockResolvedValueOnce({
      id: "o-1",
      status: "discrepancy",
    });
    const result = await markFueledAction("o-1", "Sarah", "85", "");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.resulting_status).toBe("discrepancy");
    }
  });

  it("forwards a typed discrepancy reason", async () => {
    markSupplierFuelOrderFueled.mockResolvedValueOnce({
      id: "o-1",
      status: "discrepancy",
    });
    await markFueledAction("o-1", "Sarah", "100", "Off-spec grade.");
    expect(markSupplierFuelOrderFueled).toHaveBeenCalledWith("o-1", {
      fueled_by_name: "Sarah",
      actual_quantity_gallons: 100,
      discrepancy_reason: "Off-spec grade.",
    });
  });

  it("short-circuits when name is blank", async () => {
    const result = await markFueledAction("o-1", "  ", "100", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/who's reporting/i);
    }
    expect(markSupplierFuelOrderFueled).not.toHaveBeenCalled();
  });

  it("short-circuits when gallons are blank / NaN / negative", async () => {
    for (const bad of ["", "  ", "garbage", "-5"]) {
      const result = await markFueledAction("o-1", "Sarah", bad, "");
      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.message).toMatch(/actual gallons/i);
      }
    }
    expect(markSupplierFuelOrderFueled).not.toHaveBeenCalled();
  });

  it("accepts an explicit zero gallons (e.g. truck-no-show closeout)", async () => {
    markSupplierFuelOrderFueled.mockResolvedValueOnce({
      id: "o-1",
      status: "discrepancy",
    });
    const result = await markFueledAction(
      "o-1",
      "Sarah",
      "0",
      "Truck never arrived.",
    );
    expect(result.status).toBe("ok");
    expect(markSupplierFuelOrderFueled).toHaveBeenCalledWith("o-1", {
      fueled_by_name: "Sarah",
      actual_quantity_gallons: 0,
      discrepancy_reason: "Truck never arrived.",
    });
  });

  it("maps 409 to the acknowledge-first hint", async () => {
    markSupplierFuelOrderFueled.mockRejectedValueOnce(
      new TestApiError(409, "/x", JSON.stringify({ detail: "x" })),
    );
    const result = await markFueledAction("o-1", "Sarah", "100", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/acknowledged first/i);
    }
  });

  it("maps 403 to the supplier-binding message", async () => {
    markSupplierFuelOrderFueled.mockRejectedValueOnce(
      new TestApiError(403, "/x", "Forbidden"),
    );
    const result = await markFueledAction("o-1", "Sarah", "100", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/bound to a supplier/i);
    }
  });

  it("maps 404 to the order-gone explainer", async () => {
    markSupplierFuelOrderFueled.mockRejectedValueOnce(
      new TestApiError(404, "/x", "Not Found"),
    );
    const result = await markFueledAction("o-1", "Sarah", "100", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/order not found/i);
    }
  });
});
