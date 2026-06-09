import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PositionResponse } from "@/lib/api/types";

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

// Leaflet touches `window` at import time — stub the loader.
vi.mock("@/components/flight-following/fleet-map-loader", () => ({
  FleetMapLoader: ({ positions }: { positions: PositionResponse[] }) => (
    <div data-testid="fleet-map-stub" data-count={positions.length}>
      Fleet map ({positions.length})
    </div>
  ),
}));

// AutoClock is a client component using useEffect — stub to a fixed
// string so the subtitle test doesn't depend on Date.
vi.mock("@/components/flight-following/auto-clock", () => ({
  AutoClock: () => <span data-testid="auto-clock">12:00z</span>,
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

beforeEach(() => {
  getLatestPositions.mockReset();
});

async function renderPage(searchParams: { view?: string; display?: string }) {
  const ui = await FlightFollowingPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

describe("FlightFollowingPage chrome (M2-G-10)", () => {
  it("renders the legacy title + subtitle copy with the live clock", async () => {
    await renderPage({});

    expect(
      screen.getByRole("heading", { name: /flight following/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/live ops board/i)).toBeInTheDocument();
    expect(screen.getByText(/auto-refreshes every 60 s/i)).toBeInTheDocument();
    expect(screen.getByTestId("auto-clock")).toBeInTheDocument();
  });

  it("renders the History + Open Flight buttons pointing at stub routes", async () => {
    await renderPage({});

    const history = screen.getByRole("link", { name: /^history$/i });
    expect(history).toHaveAttribute("href", "/flight-following/history");

    const open = screen.getByRole("link", { name: /open flight/i });
    expect(open).toHaveAttribute("href", "/flight-following/new");
  });

  it("highlights the active filter tab and preserves display in the href", async () => {
    await renderPage({ view: "tomorrow", display: "map" });

    const today = screen.getByRole("tab", { name: "Today" });
    const tomorrow = screen.getByRole("tab", { name: "Tomorrow" });

    expect(tomorrow).toHaveAttribute("aria-selected", "true");
    expect(today).toHaveAttribute("aria-selected", "false");
    // Today tab href drops the default `view` param but keeps display=map
    expect(today).toHaveAttribute("href", "/flight-following?display=map");
    // 7 Day tab href keeps display=map
    expect(screen.getByRole("tab", { name: "7 Day" })).toHaveAttribute(
      "href",
      "/flight-following?view=week&display=map",
    );
  });

  it("highlights the active display toggle and preserves view in the href", async () => {
    await renderPage({ view: "week", display: "split" });

    const list = screen.getByRole("tab", { name: /list/i });
    const split = screen.getByRole("tab", { name: /split/i });
    const map = screen.getByRole("tab", { name: /^map$/i });

    expect(split).toHaveAttribute("aria-selected", "true");
    expect(list).toHaveAttribute("aria-selected", "false");
    // List drops the default display but keeps view=week
    expect(list).toHaveAttribute("href", "/flight-following?view=week");
    expect(map).toHaveAttribute(
      "href",
      "/flight-following?view=week&display=map",
    );
  });

  it("renders the filter hint matching the active view", async () => {
    await renderPage({ view: "tomorrow" });
    expect(
      screen.getByText(/flights departing 24-48 hours from now/i),
    ).toBeInTheDocument();
  });

  it("falls back to defaults (today + list) when params are missing or invalid", async () => {
    await renderPage({ view: "bogus", display: "nope" });

    expect(screen.getByRole("tab", { name: "Today" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /list/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByText(/flight board lands in m2-g-11/i),
    ).toBeInTheDocument();
  });
});

describe("FlightFollowingPage list view (M2-G-10 default)", () => {
  it("renders the M2-G-11 placeholder and does NOT call the positions API", async () => {
    await renderPage({ display: "list" });

    expect(
      screen.getByText(/flight board lands in m2-g-11/i),
    ).toBeInTheDocument();
    expect(getLatestPositions).not.toHaveBeenCalled();
    expect(screen.queryByTestId("fleet-map-stub")).not.toBeInTheDocument();
  });
});

describe("FlightFollowingPage map view", () => {
  it("renders the map with positions when the fetch succeeds", async () => {
    getLatestPositions.mockResolvedValueOnce({
      items: [
        makePosition({ tail: "N207GE" }),
        makePosition({ tail: "N510PA" }),
      ],
      total: 2,
    });

    await renderPage({ display: "map" });

    const map = screen.getByTestId("fleet-map-stub");
    expect(map).toHaveAttribute("data-count", "2");
  });

  it("renders the empty-state hint when no positions exist yet", async () => {
    getLatestPositions.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ display: "map" });

    expect(screen.getByText(/No position data yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/docker compose up seed-positions/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("fleet-map-stub")).not.toBeInTheDocument();
  });

  it("renders the sign-in hint when the backend 401s", async () => {
    getLatestPositions.mockRejectedValueOnce(
      new TestApiError(401, "/positions/latest", "Unauthorized"),
    );

    await renderPage({ display: "map" });

    expect(
      screen.getByText(/session expired — please sign in again/i),
    ).toBeInTheDocument();
  });

  it("renders a generic 'feed unavailable' message on other errors", async () => {
    getLatestPositions.mockRejectedValueOnce(
      new TestApiError(502, "/positions/latest", "Bad Gateway"),
    );

    await renderPage({ display: "map" });

    expect(
      screen.getByText(/flight-following feed unavailable/i),
    ).toBeInTheDocument();
  });

  it("renders the source-colour legend under the map", async () => {
    getLatestPositions.mockResolvedValueOnce({
      items: [makePosition({ tail: "N207GE" })],
      total: 1,
    });

    await renderPage({ display: "map" });

    expect(screen.getByText(/source colour:/i)).toBeInTheDocument();
  });
});

describe("FlightFollowingPage split view", () => {
  it("renders the map AND the Tracked aircraft placeholder", async () => {
    getLatestPositions.mockResolvedValueOnce({
      items: [makePosition({ tail: "N207GE" })],
      total: 1,
    });

    await renderPage({ display: "split" });

    expect(screen.getByTestId("fleet-map-stub")).toBeInTheDocument();
    expect(screen.getByText(/tracked aircraft/i)).toBeInTheDocument();
    expect(
      screen.getByText(/side table lands in m2-g-12/i),
    ).toBeInTheDocument();
  });
});
