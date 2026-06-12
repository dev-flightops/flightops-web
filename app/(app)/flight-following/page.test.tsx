import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoardFlightItem, PositionResponse } from "@/lib/api/types";

const { TestApiError, getLatestPositions, getFlightBoard } = vi.hoisted(() => {
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
    getLatestPositions: vi.fn(),
    getFlightBoard: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/flight-following", () => ({
  getLatestPositions,
  getFlightBoard,
}));

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

// BoardFilters + ManualRefreshButton are client components that pull
// useRouter / useSearchParams from next/navigation, which isn't
// mounted in jsdom. Stub them as passive markers — their behaviours
// are exercised manually until dedicated tests land.
vi.mock("@/components/flight-following/board-filters", () => ({
  BoardFilters: () => <div data-testid="board-filters" />,
}));
vi.mock("@/components/flight-following/manual-refresh-button", () => ({
  ManualRefreshButton: () => <button type="button">Refresh</button>,
}));

// CheckInButton uses next/navigation's useRouter, which isn't mounted
// in jsdom. Stub it as a passive marker — the dedicated tests in
// check-in-action.test.ts cover the action behaviour.
vi.mock("@/components/flight-following/check-in-button", () => ({
  CheckInButton: ({
    flightId,
    event,
  }: {
    flightId: string;
    event: "depart" | "arrive";
  }) => (
    <span data-testid={`check-in-${flightId}`} data-event={event}>
      {event === "depart" ? "Mark Departed" : "Mark Arrived"}
    </span>
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

function makeBoardItem(
  overrides: Partial<BoardFlightItem> & { flight_number: string },
): BoardFlightItem {
  return {
    id: `flight-${overrides.flight_number}`,
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "Cessna 208", seats: 9 },
    origin: "PADU",
    destination: "PANC",
    scheduled_departure_at: "2026-06-15T20:00:00Z",
    scheduled_arrival_at: "2026-06-15T22:00:00Z",
    actual_departure_at: null,
    actual_arrival_at: null,
    status: "scheduled",
    pax_count: 4,
    cargo_lbs: 200,
    pic_name: null,
    is_overdue: false,
    last_contact_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  getLatestPositions.mockReset();
  getFlightBoard.mockReset();
  // Chrome tests render the list view by default, which fetches the
  // board. Default to empty so they don't need to opt in.
  getFlightBoard.mockResolvedValue({ items: [], view: "today", total: 0 });
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

    // The empty-state board CTA also renders an "Open Flight" link, so
    // assert at least one matching link points at the new-flight stub.
    const openLinks = screen.getAllByRole("link", { name: /open flight/i });
    expect(openLinks.length).toBeGreaterThanOrEqual(1);
    expect(
      openLinks.every((a) => a.getAttribute("href") === "/flight-following/new"),
    ).toBe(true);
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
    // List view default → empty board (no flights seeded) shows the
    // "No active flights" copy.
    expect(screen.getByText(/no active flights/i)).toBeInTheDocument();
  });
});

describe("FlightFollowingPage list view (M2-G-11)", () => {
  it("calls the board API with the active view and does NOT call positions", async () => {
    await renderPage({ view: "tomorrow", display: "list" });

    expect(getFlightBoard).toHaveBeenCalledWith("tomorrow");
    expect(getLatestPositions).not.toHaveBeenCalled();
  });

  it("renders one row per flight with status badges and contact times", async () => {
    getFlightBoard.mockResolvedValueOnce({
      items: [
        makeBoardItem({
          flight_number: "GV303",
          status: "released",
          last_contact_at: "2026-06-15T21:00:00Z",
        }),
        makeBoardItem({
          flight_number: "GV310",
          status: "scheduled",
          pax_count: 0,
          cargo_lbs: 0,
        }),
      ],
      view: "today",
      total: 2,
    });

    await renderPage({ display: "list" });

    expect(screen.getByText("GV303")).toBeInTheDocument();
    expect(screen.getByText("GV310")).toBeInTheDocument();
    // "Airborne" appears in two places now: the SummaryStatsBar chip
    // and the per-row status badge. We expect at least one match.
    expect(
      screen.getAllByText(/^airborne$/i).length,
    ).toBeGreaterThanOrEqual(1);
    // "Planned" also appears in both the stats chip and the row badge.
    expect(
      screen.getAllByText(/^planned$/i).length,
    ).toBeGreaterThanOrEqual(1);
    // last_contact_at on the released flight rendered as Zulu
    expect(screen.getByText(/^21:00z$/)).toBeInTheDocument();
  });

  it("renders the OVERDUE pill alongside AIRBORNE on overdue rows", async () => {
    getFlightBoard.mockResolvedValueOnce({
      items: [
        makeBoardItem({
          flight_number: "GV999",
          status: "released",
          is_overdue: true,
        }),
      ],
      view: "today",
      total: 1,
    });

    await renderPage({ display: "list" });

    expect(
      screen.getAllByText(/^airborne$/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/^overdue$/i)).toBeInTheDocument();
  });

  it("renders the empty-state CTA when there are no flights", async () => {
    await renderPage({ display: "list" });

    expect(screen.getByText(/no active flights/i)).toBeInTheDocument();
    // Empty-state CTA + header button both link to /new — assert both.
    const newLinks = screen.getAllByRole("link", { name: /open flight/i });
    expect(newLinks).toHaveLength(2);
    expect(
      newLinks.every((a) => a.getAttribute("href") === "/flight-following/new"),
    ).toBe(true);
  });

  it("renders a board-unavailable hint when the board API errors", async () => {
    getFlightBoard
      .mockReset()
      .mockRejectedValueOnce(
        new TestApiError(502, "/ops/following/board", "Bad Gateway"),
      );

    await renderPage({ display: "list" });

    expect(
      screen.getByText(/flight board unavailable/i),
    ).toBeInTheDocument();
  });

  it("renders the 'session expired' hint when the board API returns 401", async () => {
    getFlightBoard
      .mockReset()
      .mockRejectedValueOnce(
        new TestApiError(401, "/ops/following/board", "Unauthorized"),
      );

    await renderPage({ display: "list" });

    expect(
      screen.getByText(/session expired — please sign in again/i),
    ).toBeInTheDocument();
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

describe("FlightFollowingPage split view (M2-G-12)", () => {
  it("fetches BOTH the board and positions in split mode", async () => {
    getLatestPositions.mockResolvedValueOnce({
      items: [makePosition({ tail: "N207GE" })],
      total: 1,
    });
    getFlightBoard.mockResolvedValueOnce({
      items: [makeBoardItem({ flight_number: "GV1" })],
      view: "today",
      total: 1,
    });

    await renderPage({ display: "split" });

    expect(getLatestPositions).toHaveBeenCalled();
    expect(getFlightBoard).toHaveBeenCalledWith("today");
  });

  it("renders the map and merges flight + position data into the side table", async () => {
    // Same aircraft.id on both feeds so the row merges. Released
    // status with a position fix populates Alt + Spd.
    const ac = { id: "ac-1", tail_number: "N207GE", model: "Cessna 208" };
    getLatestPositions.mockResolvedValueOnce({
      items: [
        makePosition({
          tail: "N207GE",
          aircraft: { ...ac },
          altitude_ft: 8500,
          groundspeed_kt: 175,
        }),
      ],
      total: 1,
    });
    getFlightBoard.mockResolvedValueOnce({
      items: [
        makeBoardItem({
          flight_number: "GV303",
          aircraft: { ...ac, seats: 9 },
          status: "released",
        }),
      ],
      view: "today",
      total: 1,
    });

    await renderPage({ display: "split" });

    expect(screen.getByTestId("fleet-map-stub")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /tracked aircraft/i, level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("GV303")).toBeInTheDocument();
    expect(screen.getByText("8,500")).toBeInTheDocument();
    expect(screen.getByText("175 kt")).toBeInTheDocument();
  });

  it("shows -- for altitude and speed on non-airborne flights", async () => {
    const ac = { id: "ac-1", tail_number: "N207GE", model: "Cessna 208" };
    getLatestPositions.mockResolvedValueOnce({
      items: [
        makePosition({
          tail: "N207GE",
          aircraft: { ...ac },
          altitude_ft: 8500,
          groundspeed_kt: 175,
        }),
      ],
      total: 1,
    });
    getFlightBoard.mockResolvedValueOnce({
      items: [
        makeBoardItem({
          flight_number: "GV404",
          aircraft: { ...ac, seats: 9 },
          status: "scheduled",
        }),
      ],
      view: "today",
      total: 1,
    });

    await renderPage({ display: "split" });

    expect(screen.getByText("GV404")).toBeInTheDocument();
    // Two "--" cells (Alt + Spd) because the flight is scheduled, not
    // released — the latest position is stale relative to this flight.
    expect(screen.getAllByText("--")).toHaveLength(2);
    expect(screen.queryByText("8,500")).not.toBeInTheDocument();
  });

  it("renders the empty-message when no flights match the filter", async () => {
    getLatestPositions.mockResolvedValueOnce({
      items: [makePosition({ tail: "N207GE" })],
      total: 1,
    });
    getFlightBoard.mockResolvedValueOnce({
      items: [],
      view: "today",
      total: 0,
    });

    await renderPage({ display: "split" });

    expect(
      screen.getByText(/no flights match the current filter/i),
    ).toBeInTheDocument();
    // Map still renders even when the side table is empty.
    expect(screen.getByTestId("fleet-map-stub")).toBeInTheDocument();
  });

  it("surfaces the board error first when both feeds fail", async () => {
    getFlightBoard.mockReset().mockRejectedValueOnce(
      new TestApiError(401, "/ops/following/board", "Unauthorized"),
    );
    getLatestPositions.mockRejectedValueOnce(
      new TestApiError(502, "/positions/latest", "Bad Gateway"),
    );

    await renderPage({ display: "split" });

    expect(
      screen.getByText(/session expired — please sign in again/i),
    ).toBeInTheDocument();
  });
});
