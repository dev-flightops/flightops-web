import { describe, expect, it, vi } from "vitest";

import type { PositionResponse } from "@/lib/api/types";

const { TestApiError, getFlightTrack } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, getFlightTrack: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/flight-following", () => ({ getFlightTrack }));

import { getFlightTrackAction } from "./actions";

function makePosition(tail: string): PositionResponse {
  return {
    id: `pos-${tail}`,
    aircraft: { id: `ac-${tail}`, tail_number: tail, model: "Pilatus PC-12" },
    flight_id: "flight-1",
    latitude: 61.21,
    longitude: -149.9,
    altitude_ft: 8000,
    groundspeed_kt: 180,
    heading_deg: 270,
    source: "simulated",
    reported_at: "2026-06-09T12:00:00Z",
    received_at: "2026-06-09T12:00:30Z",
  };
}

describe("getFlightTrackAction", () => {
  it("returns positions on success", async () => {
    getFlightTrack.mockReset().mockResolvedValueOnce({
      items: [makePosition("N207GE"), makePosition("N207GE")],
      total: 2,
    });

    const result = await getFlightTrackAction("flight-1");

    expect(result).toEqual({
      ok: true,
      positions: [makePosition("N207GE"), makePosition("N207GE")],
    });
    expect(getFlightTrack).toHaveBeenCalledWith("flight-1");
  });

  it("returns a friendly message when the flight is gone (404)", async () => {
    getFlightTrack
      .mockReset()
      .mockRejectedValueOnce(
        new TestApiError(404, "/flight-following/flights/x/track", "Not Found"),
      );

    const result = await getFlightTrackAction("flight-1");

    expect(result).toEqual({
      ok: false,
      error: "This flight no longer exists.",
    });
  });

  it("returns a session-expired message on 401", async () => {
    getFlightTrack
      .mockReset()
      .mockRejectedValueOnce(
        new TestApiError(
          401,
          "/flight-following/flights/x/track",
          "Unauthorized",
        ),
      );

    const result = await getFlightTrackAction("flight-1");

    expect(result).toEqual({
      ok: false,
      error: "Your session expired — please sign in again.",
    });
  });

  it("returns a generic HTTP message for other ApiError statuses", async () => {
    getFlightTrack
      .mockReset()
      .mockRejectedValueOnce(
        new TestApiError(
          502,
          "/flight-following/flights/x/track",
          "Bad Gateway",
        ),
      );

    const result = await getFlightTrackAction("flight-1");

    expect(result).toEqual({
      ok: false,
      error: "Track unavailable (HTTP 502).",
    });
  });

  it("returns a fallback message for non-ApiError errors", async () => {
    getFlightTrack
      .mockReset()
      .mockRejectedValueOnce(new Error("network down"));

    const result = await getFlightTrackAction("flight-1");

    expect(result).toEqual({
      ok: false,
      error: "Track unavailable. Please try again.",
    });
  });
});
