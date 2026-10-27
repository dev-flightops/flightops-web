import { beforeEach, describe, expect, it, vi } from "vitest";

const { setPilotWeight, revalidatePath, TestApiError } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { setPilotWeight: vi.fn(), revalidatePath: vi.fn(), TestApiError };
});
vi.mock("@/lib/api/ops", () => ({ setPilotWeight }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { setPilotWeightAction } from "./weight-actions";

describe("setPilotWeightAction (#125)", () => {
  beforeEach(() => {
    setPilotWeight.mockReset().mockResolvedValue({});
  });

  it("sends whole pounds, and an empty box clears the weight", async () => {
    expect(await setPilotWeightAction("p-1", " 176 ")).toEqual({ ok: true });
    expect(setPilotWeight).toHaveBeenLastCalledWith("p-1", 176);
    expect(await setPilotWeightAction("p-1", "")).toEqual({ ok: true });
    expect(setPilotWeight).toHaveBeenLastCalledWith("p-1", null);
  });

  it("refuses what isn't a weight before asking the server", async () => {
    for (const bad of ["49", "501", "175.5", "heavy"]) {
      expect(await setPilotWeightAction("p-1", bad)).toEqual({
        ok: false,
        error: "Enter a whole number of pounds, 50 to 500.",
      });
    }
    expect(setPilotWeight).not.toHaveBeenCalled();
  });

  it("says who may change it when the server refuses", async () => {
    setPilotWeight.mockRejectedValue(new TestApiError(403, "/x", "not_your_record"));
    expect(await setPilotWeightAction("p-2", "180")).toEqual({
      ok: false,
      error: "Only the pilot or a crew manager can change this.",
    });
  });
});
