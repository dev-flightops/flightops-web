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

// The cancel button is a client component using useTransition +
// useRouter; stub it so the server render works in jsdom.
vi.mock("./cancel-stale-button", () => ({
  CancelStaleButton: ({ flightIds }: { flightIds: string[] }) => (
    <button data-testid="cancel-stale" data-count={flightIds.length}>
      Cancel stub
    </button>
  ),
}));

import EodPage from "./page";

const NOW = new Date("2026-06-15T20:00:00Z");

function makeFlight(
  overrides: Partial<FlightListItem> & { flight_number: string },
): FlightListItem {
  return {
    id: `flight-${overrides.flight_number}`,
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "C208", seats: 9 },
    origin: "PADU",
    destination: "PANC",
    scheduled_departure_at: "2026-06-15T14:00:00Z",
    scheduled_arrival_at: "2026-06-15T16:00:00Z",
    status: "completed",
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  listFlights.mockReset();
});

async function renderPage() {
  try {
    const ui = await EodPage();
    return render(ui);
  } finally {
    // Snapshots of the rendered tree should NOT use the fake clock —
    // restore here so user-event etc. behave normally in any later
    // queries within the same test.
    vi.useRealTimers();
  }
}

describe("EodPage", () => {
  it("issues three parallel listFlights calls (today completed, all released, all scheduled)", async () => {
    listFlights.mockResolvedValue({ items: [], total: 0 });

    await renderPage();

    expect(listFlights).toHaveBeenCalledTimes(3);
    const calls = listFlights.mock.calls.map((c) => c[0]);
    expect(calls).toContainEqual(
      expect.objectContaining({ status: "completed", onDate: "2026-06-15" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ status: "released" }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ status: "scheduled" }),
    );
  });

  it("renders the four stat tiles with correct counts + computed block hours", async () => {
    const twoHourFlight = (n: string) =>
      makeFlight({
        flight_number: n,
        status: "completed",
        scheduled_departure_at: "2026-06-15T14:00:00Z",
        scheduled_arrival_at: "2026-06-15T16:00:00Z",  // 2.0 hrs
      });
    listFlights
      .mockResolvedValueOnce({
        items: [twoHourFlight("C1"), twoHourFlight("C2")],
        total: 2,
      })
      .mockResolvedValueOnce({
        items: [makeFlight({ flight_number: "A1", status: "released" })],
        total: 1,
      })
      .mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    // Header heading + the data tiles
    expect(
      screen.getByRole("heading", { name: /end-of-day closeout/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Flights Completed")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // completed count
    // 2 × 2.0 hrs = 4.0
    expect(screen.getByText("4.0")).toBeInTheDocument();
    // "Still Airborne" matches both the stat tile label and the
    // section title — assert presence rather than uniqueness.
    expect(screen.getAllByText(/still airborne/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Flags")).toBeInTheDocument();
  });

  it("splits scheduled flights into stale + today-planned by current time", async () => {
    listFlights
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({
        items: [
          makeFlight({
            flight_number: "STALE",
            status: "scheduled",
            // 4h before NOW — well past the stale threshold
            scheduled_departure_at: "2026-06-15T16:00:00Z",
            scheduled_arrival_at: "2026-06-15T18:00:00Z",
          }),
          makeFlight({
            flight_number: "FUTURE",
            status: "scheduled",
            // 2h after NOW — still in the planned column
            scheduled_departure_at: "2026-06-15T22:00:00Z",
            scheduled_arrival_at: "2026-06-16T00:00:00Z",
          }),
        ],
        total: 2,
      });

    await renderPage();

    expect(screen.getByText("STALE")).toBeInTheDocument();
    expect(screen.getByText(/never departed/i)).toBeInTheDocument();
    expect(screen.getByText("FUTURE")).toBeInTheDocument();
    // Planned section header
    expect(screen.getByText(/planned — not yet departed/i)).toBeInTheDocument();
  });

  it("renders the cancel-stale button with all stale flight IDs", async () => {
    listFlights
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({
        items: [
          makeFlight({
            flight_number: "S1",
            status: "scheduled",
            scheduled_departure_at: "2026-06-15T16:00:00Z",
            scheduled_arrival_at: "2026-06-15T18:00:00Z",
          }),
          makeFlight({
            flight_number: "S2",
            status: "scheduled",
            scheduled_departure_at: "2026-06-15T17:00:00Z",
            scheduled_arrival_at: "2026-06-15T19:00:00Z",
          }),
        ],
        total: 2,
      });

    await renderPage();

    const btn = screen.getByTestId("cancel-stale");
    expect(btn).toHaveAttribute("data-count", "2");
  });

  it("renders the 'all clear' message when no flags are present", async () => {
    listFlights.mockResolvedValue({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByText(/all clear for end of day/i),
    ).toBeInTheDocument();
  });

  it("renders the empty-state copy for the Completed + Airborne sections when nothing is there", async () => {
    listFlights.mockResolvedValue({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByText(/no flights completed today/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no aircraft currently airborne/i),
    ).toBeInTheDocument();
  });

  it("renders the session-expired alert on 401", async () => {
    listFlights.mockRejectedValueOnce(
      new TestApiError(401, "/ops/flights", "Unauthorized"),
    );

    await renderPage();

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it("renders the generic error hint on backend failure", async () => {
    listFlights.mockRejectedValueOnce(
      new TestApiError(502, "/ops/flights", "Bad Gateway"),
    );

    await renderPage();

    expect(screen.getByText(/eod feed unavailable/i)).toBeInTheDocument();
  });
});
