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

import { updateVorCheckAction } from "./vor-actions";

beforeEach(() => {
  updateFlightLog.mockReset();
  revalidatePath.mockClear();
});

describe("updateVorCheckAction", () => {
  it("calls updateFlightLog + revalidates the elog path on success", async () => {
    updateFlightLog.mockResolvedValueOnce({ id: "log-1" });

    const result = await updateVorCheckAction("log-1", {
      vor_identifier: "BIG",
    });

    expect(result.status).toBe("ok");
    expect(updateFlightLog).toHaveBeenCalledWith("log-1", {
      vor_identifier: "BIG",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/flight-crew/elog/log-1");
  });

  it("maps 409 flight_log_not_in_draft_status to friendly text", async () => {
    updateFlightLog.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flight-logs/log-1",
        JSON.stringify({ detail: "flight_log_not_in_draft_status" }),
      ),
    );

    const result = await updateVorCheckAction("log-1", {
      vor_identifier: "BIG",
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/submitted and can't be edited/i);
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

    const result = await updateVorCheckAction("log-1", { vor_identifier: "B" });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/no longer exists.*reload/i);
    }
  });

  it("maps 422 to a generic validation message", async () => {
    updateFlightLog.mockRejectedValueOnce(
      new TestApiError(
        422,
        "/ops/flight-logs/log-1",
        JSON.stringify({ detail: [{ loc: ["body"], msg: "bad" }] }),
      ),
    );

    const result = await updateVorCheckAction("log-1", {
      vor_check_type: "satellite" as never,
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/invalid/i);
    }
  });

  it("maps 401 to session-expired", async () => {
    updateFlightLog.mockRejectedValueOnce(
      new TestApiError(401, "/ops/flight-logs/log-1", "Unauthorized"),
    );

    const result = await updateVorCheckAction("log-1", { vor_identifier: "B" });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/session expired/i);
    }
  });
});
