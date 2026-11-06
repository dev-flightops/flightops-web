import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, createPart, updatePart, removePart, movePart, lookupPart, redirect, revalidatePath } = vi.hoisted(() => {
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
    createPart: vi.fn(),
    updatePart: vi.fn(),
    removePart: vi.fn(),
    movePart: vi.fn(),
    lookupPart: vi.fn(),
    redirect: vi.fn((to: string) => {
      throw new Error(`REDIRECT ${to}`);
    }),
    revalidatePath: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/maintenance", () => ({ createPart, updatePart, removePart, movePart, lookupPart }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { createPartAction, lookupPartAction, movePartAction, updatePartAction } from "./actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

const full = { part_number: " CH48110-1 ", description: "Oil filter", category: "consumable", unit: "EA" };

beforeEach(() => {
  for (const fn of [createPart, updatePart, removePart, movePart, lookupPart]) fn.mockReset();
});

describe("the part form (#172)", () => {
  it("sends a clean part, then opens it", async () => {
    createPart.mockResolvedValue({ id: "p-9" });
    await expect(
      createPartAction({ status: "idle" }, form({ ...full, unit_cost: "12.50", qty_on_hand: "3", is_life_limited: "1", shelf_life_months: "24" })),
    ).rejects.toThrow("REDIRECT /maintenance/inventory/p-9");
    expect(createPart).toHaveBeenCalledWith(
      expect.objectContaining({
        part_number: "CH48110-1",
        unit_cost: "12.50",
        qty_on_hand: "3",
        qty_minimum: "0",
        is_life_limited: true,
        shelf_life_months: 24,
        manufacturer: null,
        expiration_date: null,
      }),
    );
  });

  it("names what's wrong beside the field", async () => {
    const state = await createPartAction(
      { status: "idle" },
      form({ part_number: " ", description: "", category: "consumable", unit: "EA", qty_on_hand: "many", unit_cost: "free", shelf_life_months: "1.5" }),
    );
    expect(state.status).toBe("field-errors");
    if (state.status !== "field-errors") return;
    expect(Object.keys(state.errors).sort()).toEqual(["description", "part_number", "qty_on_hand", "shelf_life_months", "unit_cost"]);
    expect(createPart).not.toHaveBeenCalled();
  });

  it("says when the same stock is already in", async () => {
    createPart.mockRejectedValue(new TestApiError(409, "/parts", JSON.stringify({ detail: "That part number and batch is already in inventory." })));
    const state = await createPartAction({ status: "idle" }, form(full));
    expect(state).toEqual({ status: "api-error", message: "That part number and batch is already in inventory." });
  });

  it("names who can when refused", async () => {
    updatePart.mockRejectedValue(new TestApiError(403, "/parts", "no"));
    const state = await updatePartAction("p-1", { status: "idle" }, form(full));
    expect(state).toEqual({ status: "api-error", message: expect.stringContaining("Only maintenance") });
  });
});

describe("moving stock (#172)", () => {
  it("refuses a quantity that isn't one before asking the server", async () => {
    for (const quantity of ["0", "-1", "lots", ""]) {
      const result = await movePartAction({ partId: "11111111-1111-4111-8111-111111111111", txn_type: "issued", quantity });
      expect(result).toEqual({ ok: false, message: "Give a quantity above zero." });
    }
    expect(movePart).not.toHaveBeenCalled();
  });

  it("turns blanks into nothing, and gives back the new quantity", async () => {
    movePart.mockResolvedValue({ qty_on_hand: 7 });
    const result = await movePartAction({
      partId: "11111111-1111-4111-8111-111111111111",
      txn_type: "issued",
      quantity: "1",
      aircraft_id: "",
      reference: "  ",
    });
    expect(result).toEqual({ ok: true, qty: 7 });
    expect(movePart).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      expect.objectContaining({ txn_type: "issued", quantity: "1", aircraft_id: null, reference: null }),
    );
  });

  it("carries the server's words back", async () => {
    movePart.mockRejectedValue(new TestApiError(409, "/parts", JSON.stringify({ detail: "CH48110-1 expired on 2026-01-01: it can't be issued." })));
    const result = await movePartAction({ partId: "11111111-1111-4111-8111-111111111111", txn_type: "issued", quantity: "1" });
    expect(result).toEqual({ ok: false, message: "CH48110-1 expired on 2026-01-01: it can't be issued." });
  });
});

describe("the barcode lookup (#172)", () => {
  it("needs a code", async () => {
    expect(await lookupPartAction("  ")).toEqual({ ok: false, message: "Scan a barcode or type a part number." });
    expect(lookupPart).not.toHaveBeenCalled();
  });
});
