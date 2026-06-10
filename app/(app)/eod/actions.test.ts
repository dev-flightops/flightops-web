import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, cancelFlight, revalidatePathSpy } = vi.hoisted(() => {
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
    cancelFlight: vi.fn(),
    revalidatePathSpy: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ cancelFlight }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathSpy }));

import { cancelStaleFlightsAction } from "./actions";

beforeEach(() => {
  cancelFlight.mockReset();
  revalidatePathSpy.mockClear();
});

describe("cancelStaleFlightsAction", () => {
  it("calls cancelFlight once per id and reports a clean count on success", async () => {
    cancelFlight.mockResolvedValue({});

    const result = await cancelStaleFlightsAction(["a", "b", "c"]);

    expect(cancelFlight).toHaveBeenCalledTimes(3);
    expect(cancelFlight).toHaveBeenNthCalledWith(1, "a");
    expect(cancelFlight).toHaveBeenNthCalledWith(2, "b");
    expect(cancelFlight).toHaveBeenNthCalledWith(3, "c");
    expect(result).toEqual({ cancelled: 3, failures: [] });
  });

  it("revalidates the /eod path so the page re-fetches after success", async () => {
    cancelFlight.mockResolvedValue({});

    await cancelStaleFlightsAction(["a"]);

    expect(revalidatePathSpy).toHaveBeenCalledWith("/eod");
  });

  it("collects partial failures with a parsed backend detail", async () => {
    cancelFlight
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        new TestApiError(
          409,
          "/ops/flights/b/cancel",
          JSON.stringify({ detail: "flight_not_cancellable_in_status_released" }),
        ),
      )
      .mockResolvedValueOnce({});

    const result = await cancelStaleFlightsAction(["a", "b", "c"]);

    expect(result.cancelled).toBe(2);
    expect(result.failures).toEqual([
      {
        flightId: "b",
        reason: "flight_not_cancellable_in_status_released",
      },
    ]);
  });

  it("surfaces the session-expired reason on 401", async () => {
    cancelFlight.mockRejectedValueOnce(
      new TestApiError(401, "/ops/flights/a/cancel", "Unauthorized"),
    );

    const result = await cancelStaleFlightsAction(["a"]);

    expect(result.cancelled).toBe(0);
    expect(result.failures[0].reason).toMatch(/session expired/i);
  });

  it("falls back to 'HTTP n' when the body isn't parseable JSON", async () => {
    cancelFlight.mockRejectedValueOnce(
      new TestApiError(502, "/ops/flights/a/cancel", "Bad Gateway"),
    );

    const result = await cancelStaleFlightsAction(["a"]);

    expect(result.failures[0].reason).toBe("HTTP 502");
  });

  it("returns clean counts on an empty input list (idempotent no-op)", async () => {
    const result = await cancelStaleFlightsAction([]);

    expect(cancelFlight).not.toHaveBeenCalled();
    expect(result).toEqual({ cancelled: 0, failures: [] });
    // Still calls revalidatePath — cheap, and keeps the action's
    // post-condition simple.
    expect(revalidatePathSpy).toHaveBeenCalledWith("/eod");
  });
});
