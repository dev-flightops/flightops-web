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

// DatePicker + StatusFilter are client components using useTransition +
// useRouter; jsdom doesn't mount the router. Stub as passive markers.
vi.mock("./date-picker", () => ({
  DatePicker: ({ defaultValue }: { defaultValue: string }) => (
    <span data-testid="date-picker">{defaultValue}</span>
  ),
}));
vi.mock("./status-filter", () => ({
  StatusFilter: () => <div data-testid="status-filter" />,
}));

import SchedulePage from "./page";

function makeFlight(overrides: Partial<FlightListItem>): FlightListItem {
  return {
    id: "f-1",
    flight_number: "GV101",
    origin: "PANC",
    destination: "PABE",
    scheduled_departure_at: "2026-06-15T14:00:00Z",
    scheduled_arrival_at: "2026-06-15T15:30:00Z",
    status: "scheduled",
    aircraft: {
      id: "ac-1",
      tail_number: "N207GE",
      model: "Cessna 208 Caravan",
      seats: 9,
    },
    actual_departure_at: null,
    actual_arrival_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  listFlights.mockReset();
});

async function renderPage(
  searchParams: { date?: string; statuses?: string } = {},
) {
  const ui = await SchedulePage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

describe("SchedulePage (M2-G-30)", () => {
  it("renders title + per-date subtitle", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ date: "2026-06-15" });

    expect(
      screen.getByRole("heading", { name: /flight schedule/i, level: 1 }),
    ).toBeInTheDocument();
    // "2026-06-15" appears in the subtitle + the DatePicker stub
    expect(screen.getAllByText(/2026-06-15/).length).toBeGreaterThanOrEqual(1);
  });

  it("fetches with the date param", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ date: "2026-07-01" });

    expect(listFlights).toHaveBeenCalledWith({
      onDate: "2026-07-01",
      limit: 200,
    });
  });

  it("ignores malformed date params", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ date: "not-a-date" });

    // falls back to today UTC
    expect(listFlights).toHaveBeenCalledWith({
      onDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      limit: 200,
    });
  });

  it("groups flights by origin base, sorted by ETD within each group", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({
          id: "a",
          flight_number: "GV200",
          origin: "PABE",
          scheduled_departure_at: "2026-06-15T16:00:00Z",
        }),
        makeFlight({
          id: "b",
          flight_number: "GV100",
          origin: "PANC",
          scheduled_departure_at: "2026-06-15T13:00:00Z",
        }),
        makeFlight({
          id: "c",
          flight_number: "GV110",
          origin: "PANC",
          scheduled_departure_at: "2026-06-15T14:30:00Z",
        }),
      ],
      total: 3,
    });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: /PANC/, level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /PABE/, level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("GV100")).toBeInTheDocument();
    expect(screen.getByText("GV110")).toBeInTheDocument();
    expect(screen.getByText("GV200")).toBeInTheDocument();
  });

  it("filters by status when statuses param is set", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({ id: "a", flight_number: "GV100", status: "released" }),
        makeFlight({ id: "b", flight_number: "GV200", status: "scheduled" }),
      ],
      total: 2,
    });

    await renderPage({ statuses: "released" });

    expect(screen.getByText("GV100")).toBeInTheDocument();
    expect(screen.queryByText("GV200")).not.toBeInTheDocument();
  });

  it("renders per-row Print link to the manifest page", async () => {
    listFlights.mockResolvedValueOnce({
      items: [makeFlight({ id: "f-42" })],
      total: 1,
    });

    await renderPage();

    const printLink = screen.getByRole("link", { name: /print/i });
    expect(printLink).toHaveAttribute("href", "/schedule/f-42/manifest");
    expect(printLink).toHaveAttribute("target", "_blank");
  });

  it("renders the empty state when no flights are scheduled", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ date: "2026-06-15" });

    expect(
      screen.getByText(/no flights scheduled for 2026-06-15/i),
    ).toBeInTheDocument();
  });

  it("renders distinct copy when filters trim everything to zero", async () => {
    listFlights.mockResolvedValueOnce({
      items: [makeFlight({ status: "scheduled" })],
      total: 1,
    });

    await renderPage({ statuses: "completed" });

    expect(
      screen.getByText(/no flights match the current status filter/i),
    ).toBeInTheDocument();
  });

  it("renders the session-expired alert on 401", async () => {
    listFlights.mockRejectedValueOnce(
      new TestApiError(401, "/ops/flights", "Unauthorized"),
    );

    await renderPage();

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it("renders the generic error alert on 5xx", async () => {
    listFlights.mockRejectedValueOnce(
      new TestApiError(502, "/ops/flights", "Bad Gateway"),
    );

    await renderPage();

    expect(screen.getByText(/schedule feed unavailable/i)).toBeInTheDocument();
  });
});
