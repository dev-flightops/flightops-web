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

import FlightFollowingHistoryPage from "./page";

const NOW = new Date("2026-06-15T20:00:00Z");

function makeFlight(
  overrides: Partial<FlightListItem> & { flight_number: string },
): FlightListItem {
  return {
    id: `flight-${overrides.flight_number}`,
    aircraft: {
      id: "ac-1",
      tail_number: "N207GE",
      model: "Cessna 208",
      seats: 9,
    },
    origin: "PADU",
    destination: "PANC",
    scheduled_departure_at: "2026-06-10T14:00:00Z",
    scheduled_arrival_at: "2026-06-10T16:00:00Z",
    status: "completed",
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
  const ui = await FlightFollowingHistoryPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

describe("FlightFollowingHistoryPage", () => {
  it("requests completed + cancelled in a single call + lists aircraft in parallel", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(listFlights).toHaveBeenCalledWith({
      status: ["completed", "cancelled"],
      limit: 200,
    });
    expect(listAircraft).toHaveBeenCalled();
  });

  it("defaults to the past-30-days range", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByRole("tab", { name: /past 30 days/i }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("renders a row per completed/cancelled flight with the right status badges", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({ flight_number: "GV101", status: "completed" }),
        makeFlight({ flight_number: "GV102", status: "cancelled" }),
      ],
      total: 2,
    });

    await renderPage({ range: "all" });

    expect(screen.getByText("GV101")).toBeInTheDocument();
    expect(screen.getByText("GV102")).toBeInTheDocument();
    // completed → LANDED badge per StatusBadge mapping
    expect(screen.getByText(/^landed$/i)).toBeInTheDocument();
    // cancelled → CANCELLED
    expect(screen.getByText(/^cancelled$/i)).toBeInTheDocument();
  });

  it("filters by the active date range (only the past 7 days)", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({
          flight_number: "RECENT",
          actual_arrival_at: "2026-06-14T16:00:00Z",  // 1d ago
        }),
        makeFlight({
          flight_number: "OLD",
          actual_arrival_at: "2026-06-01T16:00:00Z",  // 14d ago
        }),
      ],
      total: 2,
    });

    await renderPage({ range: "week" });

    expect(screen.getByText("RECENT")).toBeInTheDocument();
    expect(screen.queryByText("OLD")).not.toBeInTheDocument();
  });

  it("filters by ?aircraft= when provided", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({
          flight_number: "A",
          aircraft: { id: "ac-1", tail_number: "N207GE", model: "C208", seats: 9 },
        }),
        makeFlight({
          flight_number: "B",
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

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByText("B")).not.toBeInTheDocument();
  });

  it("renders ATD / ATA in green when actuals are set", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({
          flight_number: "REAL",
          actual_departure_at: "2026-06-10T14:05:00Z",
          actual_arrival_at: "2026-06-10T16:10:00Z",
        }),
      ],
      total: 1,
    });

    await renderPage({ range: "all" });

    // 14:05Z = 06:05 AKD in summer; 16:10Z = 08:10 AKD
    expect(screen.getByText(/06:05 AKD/)).toBeInTheDocument();
    expect(screen.getByText(/08:10 AKD/)).toBeInTheDocument();
  });

  it("renders em-dashes in ATD / ATA when actuals are missing", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({
          flight_number: "GV101",
          actual_departure_at: null,
          actual_arrival_at: null,
        }),
      ],
      total: 1,
    });

    await renderPage({ range: "all" });

    // 2 em-dash cells (ATD + ATA).
    expect(screen.getAllByText("—")).toHaveLength(2);
    // Block hours fall back to scheduled — annotated with "*"
    expect(screen.getByText(/2\.0h\*/)).toBeInTheDocument();
  });

  it("renders the empty-state copy when no terminal-status flights exist", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByText(/no completed or cancelled flights in this range/i),
    ).toBeInTheDocument();
  });

  it("renders the session-expired hint on 401", async () => {
    listFlights.mockRejectedValueOnce(
      new TestApiError(401, "/ops/flights", "Unauthorized"),
    );

    await renderPage();

    expect(
      screen.getByText(/session expired/i),
    ).toBeInTheDocument();
  });

  it("renders the generic error hint on other backend failures", async () => {
    listFlights.mockRejectedValueOnce(
      new TestApiError(502, "/ops/flights", "Bad Gateway"),
    );

    await renderPage();

    expect(
      screen.getByText(/flight history unavailable/i),
    ).toBeInTheDocument();
  });
});
