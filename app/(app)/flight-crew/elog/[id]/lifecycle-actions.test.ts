import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  deleteFlightLog,
  reopenFlightLog,
  revalidatePath,
  redirect,
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
    deleteFlightLog: vi.fn(),
    reopenFlightLog: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn((path: string) => {
      // Mimic next/navigation: throw to halt the calling function.
      const err = new Error(`REDIRECT:${path}`);
      // @ts-expect-error — sentinel used by the test assertions.
      err.digest = `NEXT_REDIRECT;${path}`;
      throw err;
    }),
    TestApiError,
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ deleteFlightLog, reopenFlightLog }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));

import {
  deleteFlightLogAction,
  reopenFlightLogAction,
} from "./lifecycle-actions";

beforeEach(() => {
  deleteFlightLog.mockReset();
  reopenFlightLog.mockReset();
  revalidatePath.mockClear();
  redirect.mockClear();
});

describe("reopenFlightLogAction", () => {
  it("POSTs + revalidates the elog detail path on success", async () => {
    reopenFlightLog.mockResolvedValueOnce({ id: "log-1", status: "draft" });

    const result = await reopenFlightLogAction("log-1", "Forgot approach counts");
    expect(result.status).toBe("ok");
    expect(reopenFlightLog).toHaveBeenCalledWith("log-1", {
      reason: "Forgot approach counts",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/flight-crew/elog/log-1");
  });

  it("forwards null reason when none provided", async () => {
    reopenFlightLog.mockResolvedValueOnce({ id: "log-1" });
    await reopenFlightLogAction("log-1", null);
    expect(reopenFlightLog).toHaveBeenCalledWith("log-1", { reason: null });
  });

  it("maps 403 to the creator-only message", async () => {
    reopenFlightLog.mockRejectedValueOnce(
      new TestApiError(
        403,
        "/ops/flight-logs/log-1/reopen",
        JSON.stringify({ detail: "reopen_creator_only" }),
      ),
    );
    const result = await reopenFlightLogAction("log-1", null);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/only the pilot.*can reopen/i);
    }
  });

  it("maps 409 reopen_window_expired to the chief-pilot hint", async () => {
    reopenFlightLog.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flight-logs/log-1/reopen",
        JSON.stringify({ detail: "reopen_window_expired" }),
      ),
    );
    const result = await reopenFlightLogAction("log-1", null);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/more than 90 days/i);
      expect(result.message).toMatch(/chief pilot/i);
    }
  });

  it("maps 409 flight_log_not_submitted to a state explainer", async () => {
    reopenFlightLog.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flight-logs/log-1/reopen",
        JSON.stringify({ detail: "flight_log_not_submitted" }),
      ),
    );
    const result = await reopenFlightLogAction("log-1", null);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/isn't submitted/i);
    }
  });

  it("maps 401 to session-expired", async () => {
    reopenFlightLog.mockRejectedValueOnce(
      new TestApiError(401, "/ops/flight-logs/log-1/reopen", "Unauthorized"),
    );
    const result = await reopenFlightLogAction("log-1", null);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/session expired/i);
    }
  });
});

describe("deleteFlightLogAction", () => {
  it("POSTs + redirects back to the elog index on success", async () => {
    deleteFlightLog.mockResolvedValueOnce({
      id: "log-1",
      deleted_at: "2026-06-26T12:00:00Z",
    });

    await expect(
      deleteFlightLogAction("log-1", "Duplicate"),
    ).rejects.toThrow(/REDIRECT:\/flight-crew\/elog/);
    expect(deleteFlightLog).toHaveBeenCalledWith("log-1", {
      reason: "Duplicate",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/flight-crew/elog");
    expect(redirect).toHaveBeenCalledWith("/flight-crew/elog");
  });

  it("maps 403 to the creator-only delete message", async () => {
    deleteFlightLog.mockRejectedValueOnce(
      new TestApiError(
        403,
        "/ops/flight-logs/log-1/delete",
        JSON.stringify({ detail: "delete_creator_only" }),
      ),
    );
    const result = await deleteFlightLogAction("log-1", null);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/only the pilot.*can delete/i);
    }
    expect(redirect).not.toHaveBeenCalled();
  });

  it("maps 409 delete_window_expired to the chief-pilot hint", async () => {
    deleteFlightLog.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flight-logs/log-1/delete",
        JSON.stringify({ detail: "delete_window_expired" }),
      ),
    );
    const result = await deleteFlightLogAction("log-1", null);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/more than 90 days/i);
    }
  });

  it("maps 422 to the reason-length cap explainer", async () => {
    deleteFlightLog.mockRejectedValueOnce(
      new TestApiError(
        422,
        "/ops/flight-logs/log-1/delete",
        JSON.stringify({ detail: [{ loc: ["body"], msg: "max_length" }] }),
      ),
    );
    const result = await deleteFlightLogAction("log-1", "x".repeat(3000));
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/2000 characters/i);
    }
  });
});
