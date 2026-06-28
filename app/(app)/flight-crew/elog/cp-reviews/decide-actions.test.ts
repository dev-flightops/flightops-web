import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  approveCpReview,
  declineCpReview,
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
    approveCpReview: vi.fn(),
    declineCpReview: vi.fn(),
    revalidatePath: vi.fn(),
    TestApiError,
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ approveCpReview, declineCpReview }));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  approveCpReviewAction,
  declineCpReviewAction,
} from "./decide-actions";

beforeEach(() => {
  approveCpReview.mockReset();
  declineCpReview.mockReset();
  revalidatePath.mockClear();
});

describe("approveCpReviewAction", () => {
  it("POSTs + revalidates the queue on success", async () => {
    approveCpReview.mockResolvedValueOnce({ id: "r-1" });
    const result = await approveCpReviewAction("r-1", "  OK per call  ");
    expect(result.status).toBe("ok");
    expect(approveCpReview).toHaveBeenCalledWith("r-1", {
      reviewer_note: "OK per call",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/flight-crew/elog/cp-reviews");
  });

  it("forwards null note when only whitespace is supplied", async () => {
    approveCpReview.mockResolvedValueOnce({ id: "r-1" });
    await approveCpReviewAction("r-1", "   ");
    expect(approveCpReview).toHaveBeenCalledWith("r-1", {
      reviewer_note: null,
    });
  });

  it("maps 403 to chief-pilot-only", async () => {
    approveCpReview.mockRejectedValueOnce(
      new TestApiError(403, "/x", JSON.stringify({ detail: "x" })),
    );
    const result = await approveCpReviewAction("r-1", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/only chief pilots/i);
    }
  });

  it("maps 409 already_decided to refresh hint", async () => {
    approveCpReview.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/x",
        JSON.stringify({ detail: "cp_review_already_decided" }),
      ),
    );
    const result = await approveCpReviewAction("r-1", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/already decided/i);
    }
  });

  it("maps 409 flight_log_already_deleted to the explainer", async () => {
    approveCpReview.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/x",
        JSON.stringify({ detail: "flight_log_already_deleted" }),
      ),
    );
    const result = await approveCpReviewAction("r-1", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/was deleted/i);
    }
  });
});

describe("declineCpReviewAction", () => {
  it("POSTs + revalidates on success", async () => {
    declineCpReview.mockResolvedValueOnce({ id: "r-1" });
    const result = await declineCpReviewAction("r-1", "Mistake — leave it.");
    expect(result.status).toBe("ok");
    expect(declineCpReview).toHaveBeenCalledWith("r-1", {
      reviewer_note: "Mistake — leave it.",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/flight-crew/elog/cp-reviews");
  });

  it("maps 404 to a friendly review-not-found message", async () => {
    declineCpReview.mockRejectedValueOnce(
      new TestApiError(404, "/x", "Not Found"),
    );
    const result = await declineCpReviewAction("r-1", "");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/review not found/i);
    }
  });
});
