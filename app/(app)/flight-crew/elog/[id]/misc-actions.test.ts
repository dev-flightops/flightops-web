import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateFlightLog, revalidatePath, TestApiError } = vi.hoisted(() => {
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
    updateFlightLog: vi.fn(),
    revalidatePath: vi.fn(),
    TestApiError,
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ updateFlightLog }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { updateMiscAction } from "./misc-actions";

beforeEach(() => {
  updateFlightLog.mockReset();
  revalidatePath.mockClear();
});

describe("updateMiscAction", () => {
  it("PATCHes + revalidates the elog path on success", async () => {
    updateFlightLog.mockResolvedValueOnce({ id: "log-1" });

    const result = await updateMiscAction("log-1", {
      mx_discrepancy: "Cabin door light intermittent",
    });

    expect(result.status).toBe("ok");
    expect(updateFlightLog).toHaveBeenCalledWith("log-1", {
      mx_discrepancy: "Cabin door light intermittent",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/flight-crew/elog/log-1");
  });

  it("forwards null mx_discrepancy to clear the field", async () => {
    updateFlightLog.mockResolvedValueOnce({ id: "log-1" });
    const result = await updateMiscAction("log-1", { mx_discrepancy: null });
    expect(result.status).toBe("ok");
    expect(updateFlightLog).toHaveBeenCalledWith("log-1", {
      mx_discrepancy: null,
    });
  });

  it("maps 409 submitted-log lockdown to a friendly message", async () => {
    updateFlightLog.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flight-logs/log-1",
        JSON.stringify({ detail: "flight_log_not_in_draft_status" }),
      ),
    );

    const result = await updateMiscAction("log-1", {
      mx_discrepancy: "x",
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/submitted and can't be edited/i);
    }
  });

  it("maps 422 to the length-cap explainer", async () => {
    updateFlightLog.mockRejectedValueOnce(
      new TestApiError(
        422,
        "/ops/flight-logs/log-1",
        JSON.stringify({ detail: [{ loc: ["body"], msg: "too long" }] }),
      ),
    );

    const result = await updateMiscAction("log-1", {
      mx_discrepancy: "x".repeat(5000),
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/4000 characters/i);
    }
  });

  it("maps 401 to session-expired", async () => {
    updateFlightLog.mockRejectedValueOnce(
      new TestApiError(401, "/ops/flight-logs/log-1", "Unauthorized"),
    );

    const result = await updateMiscAction("log-1", { mx_discrepancy: "x" });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/session expired/i);
    }
  });

  it("maps 404 flight_log_not_found to reload nudge", async () => {
    updateFlightLog.mockRejectedValueOnce(
      new TestApiError(
        404,
        "/ops/flight-logs/log-1",
        JSON.stringify({ detail: "flight_log_not_found" }),
      ),
    );

    const result = await updateMiscAction("log-1", { mx_discrepancy: "x" });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/no longer exists.*reload/i);
    }
  });
});
