import { beforeEach, describe, expect, it, vi } from "vitest";

const { patchDispatchRiskInputs, revalidatePath, TestApiError } = vi.hoisted(() => {
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
  return { patchDispatchRiskInputs: vi.fn(), revalidatePath: vi.fn(), TestApiError };
});

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/dispatch-risk", () => ({ patchDispatchRiskInputs }));

import { saveRiskInputsAction } from "./risk-actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveRiskInputsAction (#50)", () => {
  it("saves what changed and has the page re-scored", async () => {
    patchDispatchRiskInputs.mockResolvedValueOnce({});
    expect(await saveRiskInputsAction("f-1", { night_override: true })).toEqual({ ok: true });
    expect(patchDispatchRiskInputs).toHaveBeenCalledWith("f-1", { night_override: true });
    expect(revalidatePath).toHaveBeenCalledWith("/dispatch");
  });

  it.each([
    [403, "Only a dispatcher or Exec Admin can change the risk inputs."],
    [422, "That value isn't accepted. Check it and try again."],
    [404, "This flight no longer exists. Refresh the page."],
    [500, "Couldn't save. Check the connection and try again."],
  ])("explains a %s", async (status, message) => {
    patchDispatchRiskInputs.mockRejectedValueOnce(new TestApiError(status, "/x", "nope"));
    expect(await saveRiskInputsAction("f-1", { vfr_mountain_night: true })).toEqual({
      ok: false,
      error: message,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
