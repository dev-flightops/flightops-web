import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestCpReview, revalidatePath, TestApiError } = vi.hoisted(() => {
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
    requestCpReview: vi.fn(),
    revalidatePath: vi.fn(),
    TestApiError,
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ requestCpReview }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { requestCpReviewAction } from "./cp-review-actions";

beforeEach(() => {
  requestCpReview.mockReset();
  revalidatePath.mockClear();
});

describe("requestCpReviewAction", () => {
  it("POSTs the trimmed reason + revalidates the elog page", async () => {
    requestCpReview.mockResolvedValueOnce({ id: "r-1" });
    const result = await requestCpReviewAction(
      "log-1",
      "reopen",
      "  Missed leg in hobbs total  ",
    );
    expect(result.status).toBe("ok");
    expect(requestCpReview).toHaveBeenCalledWith("log-1", {
      requested_action: "reopen",
      requested_reason: "Missed leg in hobbs total",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/flight-crew/elog/log-1");
  });

  it("forwards null reason when only whitespace is supplied", async () => {
    requestCpReview.mockResolvedValueOnce({ id: "r-1" });
    await requestCpReviewAction("log-1", "delete", "   ");
    expect(requestCpReview).toHaveBeenCalledWith("log-1", {
      requested_action: "delete",
      requested_reason: null,
    });
  });

  it("maps 409 within-window detail to the reopen-it-directly hint (reopen)", async () => {
    requestCpReview.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flight-logs/log-1/cp-review",
        JSON.stringify({ detail: "cp_review_not_needed_within_window" }),
      ),
    );
    const result = await requestCpReviewAction("log-1", "reopen", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/within the 90-day window.*reopen it directly/i);
    }
  });

  it("maps 409 within-window for delete to the delete-directly hint", async () => {
    requestCpReview.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flight-logs/log-1/cp-review",
        JSON.stringify({ detail: "cp_review_not_needed_within_window" }),
      ),
    );
    const result = await requestCpReviewAction("log-1", "delete", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/delete it directly/i);
    }
  });

  it("maps 409 already-pending to the wait-for-decision message", async () => {
    requestCpReview.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flight-logs/log-1/cp-review",
        JSON.stringify({ detail: "cp_review_already_pending" }),
      ),
    );
    const result = await requestCpReviewAction("log-1", "reopen", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/already pending/i);
    }
  });

  it("maps 403 to the creator-only message", async () => {
    requestCpReview.mockRejectedValueOnce(
      new TestApiError(
        403,
        "/ops/flight-logs/log-1/cp-review",
        JSON.stringify({ detail: "cp_review_creator_only" }),
      ),
    );
    const result = await requestCpReviewAction("log-1", "reopen", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/only the pilot/i);
    }
  });

  it("maps 401 to session-expired", async () => {
    requestCpReview.mockRejectedValueOnce(
      new TestApiError(401, "/x", "Unauthorized"),
    );
    const result = await requestCpReviewAction("log-1", "reopen", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/session expired/i);
    }
  });
});
