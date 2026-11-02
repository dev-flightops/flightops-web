import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, createFuelType, updateFuelType, revalidatePath } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, createFuelType: vi.fn(), updateFuelType: vi.fn(), revalidatePath: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ createFuelType, updateFuelType }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { addFuelTypeAction, setFuelTypeActiveAction } from "./actions";

beforeEach(() => vi.clearAllMocks());

describe("addFuelTypeAction (#134)", () => {
  it("leaves a blank code for the service to make from the label, sorted 100 by default", async () => {
    createFuelType.mockResolvedValueOnce({ id: "ft-1" });
    expect(await addFuelTypeAction({ label: " Jet A + Prist ", code: " ", sort_order: "" })).toEqual({ ok: true });
    expect(createFuelType).toHaveBeenCalledWith({ code: null, label: "Jet A + Prist", sort_order: 100 });
    expect(revalidatePath).toHaveBeenCalledWith("/fuel/types");
  });

  it("keeps a code and sort order given", async () => {
    createFuelType.mockResolvedValueOnce({ id: "ft-2" });
    await addFuelTypeAction({ label: "Mogas", code: "MOGAS91", sort_order: "40" });
    expect(createFuelType).toHaveBeenCalledWith({ code: "MOGAS91", label: "Mogas", sort_order: 40 });
  });

  it("needs a label and a whole sort order", async () => {
    expect(await addFuelTypeAction({ label: "", code: "", sort_order: "" })).toEqual({
      ok: false,
      error: "Give the fuel type's label.",
    });
    expect(await addFuelTypeAction({ label: "Mogas", code: "", sort_order: "1.5" })).toEqual({
      ok: false,
      error: "The sort order is a whole number.",
    });
    expect(createFuelType).not.toHaveBeenCalled();
  });

  it("says when the code is taken", async () => {
    createFuelType.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ground/fuel/types",
        JSON.stringify({ detail: { error: "fuel_type_code_taken", message: "There's already a fuel type with the code JET_A." } }),
      ),
    );
    expect(await addFuelTypeAction({ label: "Jet A", code: "", sort_order: "" })).toEqual({
      ok: false,
      error: "There's already a fuel type with the code JET_A.",
    });
  });
});

describe("setFuelTypeActiveAction (#134)", () => {
  it("switches the type off and on", async () => {
    updateFuelType.mockResolvedValue({ id: "ft-1" });
    expect(await setFuelTypeActiveAction("ft-1", false)).toEqual({ ok: true });
    expect(updateFuelType).toHaveBeenCalledWith("ft-1", { is_active: false });
  });

  it("says who may when the service refuses", async () => {
    updateFuelType.mockRejectedValueOnce(new TestApiError(403, "/ground/fuel/types/ft-1", "{}"));
    expect((await setFuelTypeActiveAction("ft-1", true)).error).toMatch(/can change the fuel types\.$/);
  });
});
