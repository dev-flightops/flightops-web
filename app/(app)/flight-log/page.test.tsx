import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AircraftListItem,
  FlightListItem,
} from "@/lib/api/types";

const { TestApiError, listFlights, listAircraft } = vi.hoisted(() => {
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
    listFlights: vi.fn(),
    listAircraft: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ listFlights, listAircraft }));

import FlightLogPage from "./page";

const NOW = new Date("2026-06-15T20:00:00Z");

function makeFlight(
  overrides: Partial<FlightListItem> & { id: string },
): FlightListItem {
  return {
    flight_number: `GV${overrides.id}`,
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "C208", seats: 9 },
    origin: "PADU",
    destination: "PANC",
    scheduled_departure_at: "2026-06-15T14:00:00Z",
    scheduled_arrival_at: "2026-06-15T16:00:00Z",
    status: "completed",
    actual_departure_at: "2026-06-15T14:05:00Z",
    actual_arrival_at: "2026-06-15T16:10:00Z",
    ...overrides,
  };
}

function makeAircraft(id: string, tail: string): AircraftListItem {
  return {
    id,
    tail_number: tail,
    model: "C208",
    seats: 9,
    max_payload_lbs: 3000,
    is_active: true,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  listFlights.mockReset();
  listAircraft.mockReset();
  listAircraft.mockResolvedValue({ items: [], total: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

async function renderPage(
  searchParams: { range?: string; aircraft?: string } = {},
) {
  const ui = await FlightLogPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

describe("FlightLogPage", () => {
  it("requests completed flights only + lists aircraft in parallel", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(listFlights).toHaveBeenCalledWith({
      status: "completed",
      limit: 200,
    });
    expect(listAircraft).toHaveBeenCalled();
  });

  it("defaults to the past-7-days range when no ?range is given", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByRole("tab", { name: /past 7 days/i }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("falls back to 'week' on a bogus ?range value", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ range: "decade" });

    expect(
      screen.getByRole("tab", { name: /past 7 days/i }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("filters flights by the active date range (only the past 7 days)", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({
          id: "recent",
          actual_arrival_at: "2026-06-14T16:00:00Z", // 1 day ago
        }),
        makeFlight({
          id: "old",
          actual_arrival_at: "2026-06-01T16:00:00Z", // 14 days ago — out of range
        }),
      ],
      total: 2,
    });

    await renderPage();

    expect(screen.getByText("GVrecent")).toBeInTheDocument();
    expect(screen.queryByText("GVold")).not.toBeInTheDocument();
  });

  it("widens the window to 'All time' when range=all", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({
          id: "old",
          actual_arrival_at: "2025-01-01T16:00:00Z",
        }),
      ],
      total: 1,
    });

    await renderPage({ range: "all" });

    expect(screen.getByText("GVold")).toBeInTheDocument();
  });

  it("filters by ?aircraft= when provided", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({
          id: "a",
          aircraft: { id: "ac-1", tail_number: "N207GE", model: "C208", seats: 9 },
        }),
        makeFlight({
          id: "b",
          aircraft: { id: "ac-2", tail_number: "N510PA", model: "B1900", seats: 19 },
        }),
      ],
      total: 2,
    });
    listAircraft.mockResolvedValueOnce({
      items: [makeAircraft("ac-1", "N207GE"), makeAircraft("ac-2", "N510PA")],
      total: 2,
    });

    await renderPage({ range: "all", aircraft: "ac-1" });

    expect(screen.getByText("GVa")).toBeInTheDocument();
    expect(screen.queryByText("GVb")).not.toBeInTheDocument();
  });

  it("renders ATD / ATA in green when actuals are set", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({
          id: "real",
          actual_departure_at: "2026-06-15T14:05:00Z",
          actual_arrival_at: "2026-06-15T16:10:00Z",
        }),
      ],
      total: 1,
    });

    await renderPage({ range: "all" });

    // 14:05 UTC = 06:05 AKD in summer (UTC-8); 16:10Z = 08:10 AKD.
    expect(screen.getByText(/06:05 AKD/)).toBeInTheDocument();
    expect(screen.getByText(/08:10 AKD/)).toBeInTheDocument();
  });

  it("falls back to a 'sched' tag when actuals are missing", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({
          id: "noactual",
          actual_departure_at: null,
          actual_arrival_at: null,
        }),
      ],
      total: 1,
    });

    await renderPage({ range: "all" });

    // Two cells (ATD + ATA) render the "sched" tag.
    expect(screen.getAllByText(/^sched$/i)).toHaveLength(2);
    // Block hours get a "*" suffix to indicate scheduled-times proxy.
    expect(screen.getByText(/2\.0h\*/)).toBeInTheDocument();
  });

  it("renders the summary strip with count + total block hours", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({ id: "x" }),  // 2:05 block (14:05 → 16:10)
        makeFlight({ id: "y" }),
      ],
      total: 2,
    });

    await renderPage({ range: "all" });

    // Count label appears in the summary strip.
    expect(screen.getByText(/^flights$/i)).toBeInTheDocument();
    // 2 flights × 2:05 each ≈ 4.2h — locale-formatted
    expect(screen.getByText("4.2")).toBeInTheDocument();
    expect(screen.getByText(/^block hrs$/i)).toBeInTheDocument();
  });

  it("renders the empty-state copy when no flights match the filter", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByText(/no completed flights in this range/i),
    ).toBeInTheDocument();
  });

  it("renders the session-expired banner on 401", async () => {
    listFlights.mockRejectedValueOnce(
      new TestApiError(401, "/ops/flights", "Unauthorized"),
    );

    await renderPage();

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it("renders the generic error banner on 5xx", async () => {
    listFlights.mockRejectedValueOnce(
      new TestApiError(502, "/ops/flights", "Bad Gateway"),
    );

    await renderPage();

    expect(
      screen.getByText(/flight log unavailable/i),
    ).toBeInTheDocument();
  });
});
