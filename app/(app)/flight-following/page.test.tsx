import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PositionResponse } from "@/lib/api/types";

// Same hoisted-mock pattern as the dispatch panel tests — vi.mock
// factories run before top-level code. ApiError is stubbed because
// the real one transitively imports next-auth → next/server which
// vitest can't resolve.
const { TestApiError, getLatestPositions } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, getLatestPositions: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/flight-following", () => ({ getLatestPositions }));

// Stub the map loader — Leaflet touches `window` at import time and
// we don't render real tiles in unit tests. Just confirm the loader
// got the right positions.
vi.mock("@/components/flight-following/fleet-map-loader", () => ({
  FleetMapLoader: ({ positions }: { positions: PositionResponse[] }) => (
    <div data-testid="fleet-map-stub" data-count={positions.length}>
      Fleet map ({positions.length})
    </div>
  ),
}));

import FlightFollowingPage from "./page";

function makePosition(
  overrides: Partial<PositionResponse> & { tail: string },
): PositionResponse {
  const { tail, ...rest } = overrides;
  return {
    id: `pos-${tail}`,
    aircraft: { id: `ac-${tail}`, tail_number: tail, model: "Pilatus PC-12" },
    flight_id: null,
    latitude: 61.21,
    longitude: -149.9,
    altitude_ft: 8000,
    groundspeed_kt: 180,
    heading_deg: 270,
    source: "simulated",
    reported_at: "2026-06-09T12:00:00Z",
    received_at: "2026-06-09T12:00:30Z",
    ...rest,
  };
}

describe("FlightFollowingPage", () => {
  it("renders the map with positions when the fetch succeeds", async () => {
    getLatestPositions.mockReset().mockResolvedValueOnce({
      items: [
        makePosition({ tail: "N207GE" }),
        makePosition({ tail: "N510PA" }),
      ],
      total: 2,
    });

    const ui = await FlightFollowingPage();
    render(ui);

    const map = screen.getByTestId("fleet-map-stub");
    expect(map).toHaveAttribute("data-count", "2");
    expect(screen.getByText(/2 aircraft tracked/i)).toBeInTheDocument();
  });

  it("renders the pulled-at timestamp from the newest reported_at", async () => {
    getLatestPositions.mockReset().mockResolvedValueOnce({
      items: [
        makePosition({ tail: "A", reported_at: "2026-06-09T10:00:00Z" }),
        makePosition({ tail: "B", reported_at: "2026-06-09T15:30:00Z" }),
        makePosition({ tail: "C", reported_at: "2026-06-09T11:45:00Z" }),
      ],
      total: 3,
    });

    const ui = await FlightFollowingPage();
    render(ui);

    expect(screen.getByText(/15:30Z/)).toBeInTheDocument();
  });

  it("renders the empty-state hint when no positions exist yet", async () => {
    getLatestPositions.mockReset().mockResolvedValueOnce({
      items: [],
      total: 0,
    });

    const ui = await FlightFollowingPage();
    render(ui);

    expect(
      screen.getByText(/No position data yet/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/docker compose up seed-positions/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("fleet-map-stub")).not.toBeInTheDocument();
  });

  it("renders a sign-in hint when the backend 401s", async () => {
    getLatestPositions
      .mockReset()
      .mockRejectedValueOnce(
        new TestApiError(
          401,
          "/flight-following/positions/latest",
          "Unauthorized",
        ),
      );

    const ui = await FlightFollowingPage();
    render(ui);

    expect(
      screen.getByText(/session expired — please sign in again/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("fleet-map-stub")).not.toBeInTheDocument();
  });

  it("renders a generic 'feed unavailable' message on other errors", async () => {
    getLatestPositions
      .mockReset()
      .mockRejectedValueOnce(
        new TestApiError(
          502,
          "/flight-following/positions/latest",
          "Bad Gateway",
        ),
      );

    const ui = await FlightFollowingPage();
    render(ui);

    expect(
      screen.getByText(/Flight-following feed unavailable/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("fleet-map-stub")).not.toBeInTheDocument();
  });
});
