import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, updateGseUnit, redirectSpy } = vi.hoisted(() => {
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
    updateGseUnit: vi.fn(),
    redirectSpy: vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    }),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ updateGseUnit }));
vi.mock("next/navigation", () => ({ redirect: redirectSpy }));

import { updateEquipmentAction } from "./actions";

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("updateEquipmentAction (#134)", () => {
  it("sends every field, an emptied one as null, then opens the unit", async () => {
    updateGseUnit.mockResolvedValueOnce({ id: "u-1" });
    await expect(
      updateEquipmentAction(
        "u-1",
        { status: "idle" },
        form({
          name: "GPU 2",
          equipment_type: "gpu",
          make: "Hobart",
          model: "",
          serial_number: "",
          year: "2009",
          station_id: "",
          hours_total: "6447",
          service_interval_days: "180",
          next_service_date: "2027-04-30",
          manufacturer: "",
          notes: "",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(updateGseUnit).toHaveBeenCalledWith("u-1", {
      name: "GPU 2",
      equipment_type: "gpu",
      make: "Hobart",
      model: null,
      serial_number: null,
      year: 2009,
      station_id: null,
      service_interval_days: 180,
      next_service_date: "2027-04-30",
      hours_total: 6447,
      manufacturer: null,
      notes: null,
    });
    expect(redirectSpy).toHaveBeenCalledWith("/equipment/u-1");
  });

  it("marks a bad field and saves nothing", async () => {
    const state = await updateEquipmentAction("u-1", { status: "idle" }, form({ name: "", equipment_type: "gpu" }));
    expect(state).toEqual({ status: "field-errors", errors: { name: "Name is required" } });
    expect(updateGseUnit).not.toHaveBeenCalled();
  });

  it("says who may edit, and when a station has gone", async () => {
    updateGseUnit.mockRejectedValueOnce(new TestApiError(403, "/ground/gse/u-1", "insufficient_role"));
    const refused = await updateEquipmentAction("u-1", { status: "idle" }, form({ name: "GPU 2", equipment_type: "gpu" }));
    expect(refused.status === "api-error" && refused.message).toMatch(/^Only Ground Ops/);
    updateGseUnit.mockRejectedValueOnce(new TestApiError(404, "/ground/gse/u-1", JSON.stringify({ detail: "station x not found" })));
    const gone = await updateEquipmentAction("u-1", { status: "idle" }, form({ name: "GPU 2", equipment_type: "gpu" }));
    expect(gone).toEqual({ status: "field-errors", errors: { station_id: "That station isn't in your fleet anymore." } });
  });
});
