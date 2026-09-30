import { describe, expect, it, vi } from "vitest";

const { TestApiError, createGseUnit } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, createGseUnit: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ createGseUnit }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { createEquipmentAction } from "./actions";

describe("createEquipmentAction refused by role (29 Sep)", () => {
  it("says who can add equipment", async () => {
    createGseUnit.mockRejectedValueOnce(new TestApiError(403, "/ground/gse", "insufficient_role"));
    const fd = new FormData();
    fd.set("name", "Tug A-12");
    fd.set("equipment_type", "tug");
    expect(await createEquipmentAction({ status: "idle" }, fd)).toEqual({
      status: "api-error",
      message:
        "Only Ground Ops, the Director of Maintenance, the Director of Operations or an Exec Admin can add equipment.",
    });
  });
});
