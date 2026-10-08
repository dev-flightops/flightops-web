import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, saveAsapReview, revalidatePath } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, saveAsapReview: vi.fn(), revalidatePath: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/asap", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/asap")>()),
  saveAsapReview,
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { saveAsapReviewAction } from "./actions";

const REPORT = "8f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

function form(fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    report_id: REPORT,
    review_date: "2026-10-06",
    decision: "accepted",
    erc_participants: "Company, FAA and union reps",
    decision_rationale: "Sole source.",
    corrective_action_summary: "",
    ...fields,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  saveAsapReview.mockReset();
  revalidatePath.mockClear();
});

describe("saving an ERC review (#59)", () => {
  it("sends every field, a blank one as a clear, and refreshes the hub", async () => {
    saveAsapReview.mockResolvedValueOnce({});
    const state = await saveAsapReviewAction({ status: "idle", attempt: 0 }, form({ de_identified: "on" }));
    expect(saveAsapReview).toHaveBeenCalledWith(REPORT, {
      review_date: "2026-10-06",
      decision: "accepted",
      erc_participants: "Company, FAA and union reps",
      decision_rationale: "Sole source.",
      corrective_action_summary: null,
      de_identified: true,
    });
    expect(state).toEqual({ status: "ok", attempt: 1 });
    expect(revalidatePath).toHaveBeenCalledWith("/safety/asap");
  });

  it("refuses a decision legacy doesn't have, keeping what was typed", async () => {
    const state = await saveAsapReviewAction({ status: "idle", attempt: 3 }, form({ decision: "approved" }));
    expect(saveAsapReview).not.toHaveBeenCalled();
    expect(state.status).toBe("error");
    expect(state.attempt).toBe(4);
    expect(state.values?.decision_rationale).toBe("Sole source.");
  });

  it("explains a refusal for anyone outside the three ASAP roles", async () => {
    saveAsapReview.mockRejectedValueOnce(new TestApiError(403, "/safety/asap/reviews/x", "insufficient_role"));
    const state = await saveAsapReviewAction({ status: "idle", attempt: 0 }, form());
    expect(state.message).toBe("Only the Safety Officer, the DO and Exec Admins record ERC reviews.");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
