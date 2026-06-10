import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FlightListItem } from "@/lib/api/types";

const { TestApiError, listFlights } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, listFlights: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ listFlights }));

import FlightFollowingHistoryPage from "./page";

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
    scheduled_departure_at: "2026-07-01T14:00:00Z",
    scheduled_arrival_at: "2026-07-01T16:00:00Z",
    status: "completed",
    ...overrides,
  };
}

beforeEach(() => {
  listFlights.mockReset();
});

async function renderPage() {
  const ui = await FlightFollowingHistoryPage();
  return render(ui);
}

describe("FlightFollowingHistoryPage", () => {
  it("requests completed + cancelled in a single call with the right limit", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(listFlights).toHaveBeenCalledTimes(1);
    expect(listFlights).toHaveBeenCalledWith({
      status: ["completed", "cancelled"],
      limit: 100,
    });
  });

  it("renders a table row per flight with the right status badges", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({ flight_number: "GV101", status: "completed" }),
        makeFlight({ flight_number: "GV102", status: "cancelled" }),
      ],
      total: 2,
    });

    await renderPage();

    expect(screen.getByText("GV101")).toBeInTheDocument();
    expect(screen.getByText("GV102")).toBeInTheDocument();
    // completed → LANDED label per StatusBadge mapping
    expect(screen.getByText(/^landed$/i)).toBeInTheDocument();
    // cancelled → CANCELLED
    expect(screen.getByText(/^cancelled$/i)).toBeInTheDocument();
  });

  it("renders em-dash placeholders in the ATD / ATA columns (M2-G-11b lights them up)", async () => {
    listFlights.mockResolvedValueOnce({
      items: [makeFlight({ flight_number: "GV101" })],
      total: 1,
    });

    await renderPage();

    // 2 dashes per row (ATD + ATA).
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("renders the empty-state copy when no terminal-status flights exist", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByText(/no completed or cancelled flights yet/i),
    ).toBeInTheDocument();
  });

  it("renders the session-expired hint on 401", async () => {
    listFlights.mockRejectedValueOnce(
      new TestApiError(401, "/ops/flights", "Unauthorized"),
    );

    await renderPage();

    expect(
      screen.getByText(/session expired — please sign in again/i),
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
