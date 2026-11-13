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

  // LOG-14: a multi-stop flight is marked at each stop.
  it("sends the stop's leg and a typed time with the mark", async () => {
    checkInFlight.mockResolvedValueOnce({});
    await checkInFlightAction("flight-1", "arrive", false, { at: "2026-11-13T19:30:00Z", leg: 1 });
    expect(checkInFlight).toHaveBeenCalledWith("flight-1", { event: "arrive", at: "2026-11-13T19:30:00Z", leg: 1 });
  });

  it.each([
    ['{"detail":"previous_stop_not_arrived"}', "It's still in the air: mark its arrival at the next stop first."],
    ['{"detail":"next_leg_not_departed"}', "It's on the ground at a stop: mark its departure from there first."],
    ['{"detail":"departure_before_arrival_at_stop"}', "It can't leave the stop before it landed there. Check the time."],
    ['{"detail":"check_in_time_too_far_in_past"}', "That time is more than a day before the flight was due to leave."],
  ])("explains a stop marked out of turn (%s)", async (body, error) => {
    checkInFlight.mockRejectedValueOnce(new TestApiError(409, "/ops/flights/x/check-in", body));
    expect(await checkInFlightAction("flight-1", "depart")).toEqual({ ok: false, error });
  });

  it("brings the board up to date when someone marked the stop meanwhile", async () => {
    checkInFlight.mockRejectedValueOnce(
      new TestApiError(409, "/ops/flights/x/check-in", '{"detail":{"error":"stop_already_marked","leg":2}}'),
    );
    const result = await checkInFlightAction("flight-1", "arrive", false, { leg: 1 });
    expect(result).toEqual({
      ok: false,
      error: "Someone has marked that stop already. Close this and look at the board again.",
    });
    expect(revalidatePathSpy).toHaveBeenCalledWith("/flight-following");
  });
});
