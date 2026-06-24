import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  addFlightLogLeg,
  updateFlightLogLeg,
  deleteFlightLogLeg,
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
    addFlightLogLeg: vi.fn(),
    updateFlightLogLeg: vi.fn(),
    deleteFlightLogLeg: vi.fn(),
    revalidatePath: vi.fn(),
    TestApiError,
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({
  addFlightLogLeg,
  updateFlightLogLeg,
  deleteFlightLogLeg,
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  addLegAction,
  deleteLegAction,
  updateLegAction,
} from "./legs-actions";

beforeEach(() => {
  addFlightLogLeg.mockReset();
  updateFlightLogLeg.mockReset();
  deleteFlightLogLeg.mockReset();
  revalidatePath.mockClear();
});

describe("addLegAction", () => {
  it("calls addFlightLogLeg + revalidates the parent path", async () => {
    addFlightLogLeg.mockResolvedValueOnce({ id: "leg-1", leg_number: 1 });

    const result = await addLegAction("log-1");

    expect(result.status).toBe("ok");
    expect(addFlightLogLeg).toHaveBeenCalledWith("log-1");
    expect(revalidatePath).toHaveBeenCalledWith("/flight-crew/elog/log-1");
  });

  it("maps 409 flight_log_not_in_draft_status to a friendly message", async () => {
    addFlightLogLeg.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flight-logs/log-1/legs",
        JSON.stringify({ detail: "flight_log_not_in_draft_status" }),
      ),
    );

    const result = await addLegAction("log-1");

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/submitted and can't be edited/i);
    }
  });

  it("maps 401 to the session-expired message", async () => {
    addFlightLogLeg.mockRejectedValueOnce(
      new TestApiError(401, "/ops/flight-logs/log-1/legs", "Unauthorized"),
    );

    const result = await addLegAction("log-1");

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/session expired/i);
    }
  });
});

describe("updateLegAction", () => {
  it("PATCHes the diff and revalidates", async () => {
    updateFlightLogLeg.mockResolvedValueOnce({ id: "leg-1" });

    const result = await updateLegAction("log-1", "leg-1", { landings: 2 });

    expect(result.status).toBe("ok");
    expect(updateFlightLogLeg).toHaveBeenCalledWith("log-1", "leg-1", {
      landings: 2,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/flight-crew/elog/log-1");
  });

  it("maps 422 night-landings violator to a focused message", async () => {
    updateFlightLogLeg.mockRejectedValueOnce(
      new TestApiError(
        422,
        "/ops/flight-logs/log-1/legs/leg-1",
        JSON.stringify({
          detail: [
            {
              loc: ["body"],
              type: "value_error",
              msg: "night_landings cannot exceed landings",
            },
          ],
        }),
      ),
    );

    const result = await updateLegAction("log-1", "leg-1", {
      night_landings: 3,
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/night landings can't exceed/i);
    }
  });

  it("maps 404 leg_not_found to a 'reload' nudge", async () => {
    updateFlightLogLeg.mockRejectedValueOnce(
      new TestApiError(
        404,
        "/ops/flight-logs/log-1/legs/leg-1",
        JSON.stringify({ detail: "leg_not_found" }),
      ),
    );

    const result = await updateLegAction("log-1", "leg-1", { landings: 1 });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/no longer exists.*reload/i);
    }
  });
});

describe("deleteLegAction", () => {
  it("deletes and revalidates on success", async () => {
    deleteFlightLogLeg.mockResolvedValueOnce(undefined);

    const result = await deleteLegAction("log-1", "leg-1");

    expect(result.status).toBe("ok");
    expect(deleteFlightLogLeg).toHaveBeenCalledWith("log-1", "leg-1");
    expect(revalidatePath).toHaveBeenCalledWith("/flight-crew/elog/log-1");
  });

  it("surfaces submitted-log 409 with the same friendly message", async () => {
    deleteFlightLogLeg.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flight-logs/log-1/legs/leg-1",
        JSON.stringify({ detail: "flight_log_not_in_draft_status" }),
      ),
    );

    const result = await deleteLegAction("log-1", "leg-1");

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/submitted and can't be edited/i);
    }
  });
});
