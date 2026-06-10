import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, checkInFlight, revalidatePathSpy } = vi.hoisted(() => {
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
    TestApiError,
    checkInFlight: vi.fn(),
    revalidatePathSpy: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ checkInFlight }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathSpy }));

import { checkInFlightAction } from "./check-in-action";

beforeEach(() => {
  checkInFlight.mockReset();
  revalidatePathSpy.mockClear();
});

describe("checkInFlightAction", () => {
  it("calls checkInFlight with the event and revalidates on success", async () => {
    checkInFlight.mockResolvedValueOnce({});

    const result = await checkInFlightAction("flight-1", "depart");

    expect(checkInFlight).toHaveBeenCalledWith("flight-1", { event: "depart" });
    expect(revalidatePathSpy).toHaveBeenCalledWith("/flight-following");
    expect(result).toEqual({ ok: true });
  });

  it("maps cannot_arrive_before_departing to a friendly message", async () => {
    checkInFlight.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flights/x/check-in",
        JSON.stringify({ detail: "cannot_arrive_before_departing" }),
      ),
    );

    const result = await checkInFlightAction("flight-1", "arrive");

    expect(result).toEqual({
      ok: false,
      error: "Mark the flight Departed first, then Arrived.",
    });
    // No revalidate on failure — the row didn't change.
    expect(revalidatePathSpy).not.toHaveBeenCalled();
  });

  it("maps actual_departure_already_recorded to an 'already' message", async () => {
    checkInFlight.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flights/x/check-in",
        JSON.stringify({ detail: "actual_departure_already_recorded" }),
      ),
    );

    const result = await checkInFlightAction("flight-1", "depart");

    expect(result).toEqual({
      ok: false,
      error: "This flight is already marked departed.",
    });
  });

  it("maps arrival_before_departure to a clear copy", async () => {
    checkInFlight.mockRejectedValueOnce(
      new TestApiError(
        422,
        "/ops/flights/x/check-in",
        JSON.stringify({ detail: "arrival_before_departure" }),
      ),
    );

    const result = await checkInFlightAction("flight-1", "arrive");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/can't be before/i);
    }
  });

  it("decodes flight_not_checkinable_in_status_X into the actual status word", async () => {
    checkInFlight.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/ops/flights/x/check-in",
        JSON.stringify({
          detail: "flight_not_checkinable_in_status_cancelled",
        }),
      ),
    );

    const result = await checkInFlightAction("flight-1", "depart");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/cancelled/i);
    }
  });

  it("surfaces the session-expired error on 401", async () => {
    checkInFlight.mockRejectedValueOnce(
      new TestApiError(401, "/ops/flights/x/check-in", "Unauthorized"),
    );

    const result = await checkInFlightAction("flight-1", "depart");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/session expired/i);
    }
  });

  it("falls back to a generic HTTP error for unknown statuses", async () => {
    checkInFlight.mockRejectedValueOnce(
      new TestApiError(502, "/ops/flights/x/check-in", "Bad Gateway"),
    );

    const result = await checkInFlightAction("flight-1", "depart");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/HTTP 502/);
    }
  });
});
