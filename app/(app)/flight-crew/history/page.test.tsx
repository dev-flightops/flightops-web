import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listFlightLogs, listDutyHistory, TestApiError } = vi.hoisted(() => {
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
    listFlightLogs: vi.fn(),
    listDutyHistory: vi.fn(),
    TestApiError,
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ listFlightLogs, listDutyHistory }));

import FlightCrewHistoryPage from "./page";
import type {
  DutyPeriodSummary,
  FlightLogResponse,
} from "@/lib/api/types";

function makeLog(over: Partial<FlightLogResponse> & { id: string }): FlightLogResponse {
  return {
    log_number: `LOG-20260601-${over.id}`,
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "C208", seats: 9 },
    flight_id: null,
    flight_number: null,
    flight_type: "advisory",
    flight_date: "2026-06-01",
    status: "submitted",
    is_manual_entry: false,
    created_by: { id: "u-1", full_name: "Pilot", email: "p@x" },
    created_at: "2026-06-01T12:00:00Z",
    ...over,
  };
}

function makeDuty(over: Partial<DutyPeriodSummary> & { id: string }): DutyPeriodSummary {
  return {
    clock_in_at: "2026-06-01T15:00:00Z",
    clock_out_at: "2026-06-01T23:00:00Z",
    elapsed_hours: 8,
    is_open: false,
    rest_acknowledged: false,
    ...over,
  };
}

async function renderPage(searchParams: Record<string, string> = {}) {
  // The page is an async server component — invoke it to get the
  // JSX tree, then hand that to RTL render.
  const ui = await FlightCrewHistoryPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

beforeEach(() => {
  listFlightLogs.mockReset();
  listDutyHistory.mockReset();
});

describe("FlightCrewHistoryPage", () => {
  it("renders the Flight tab by default and lists own logs", async () => {
    listFlightLogs.mockResolvedValueOnce({
      items: [
        makeLog({ id: "1", log_number: "LOG-A", flight_number: "GV101" }),
        makeLog({ id: "2", log_number: "LOG-B", is_manual_entry: true }),
      ],
      total: 2,
    });

    await renderPage();

    expect(listFlightLogs).toHaveBeenCalledWith(
      expect.objectContaining({ mine: true, limit: 200 }),
    );
    expect(listDutyHistory).not.toHaveBeenCalled();
    expect(screen.getByText("LOG-A")).toBeInTheDocument();
    expect(screen.getByText("LOG-B")).toBeInTheDocument();
    // Manual-entry badge rendered for the second row.
    expect(screen.getByText(/manual entry/i)).toBeInTheDocument();
  });

  it("renders the Duty tab when tab=duty is in the URL", async () => {
    listDutyHistory.mockResolvedValueOnce({
      items: [
        makeDuty({ id: "d-1", elapsed_hours: 9.5 }),
        makeDuty({ id: "d-2", clock_out_at: null, is_open: true, elapsed_hours: 4.2 }),
      ],
      total: 2,
    });

    await renderPage({ tab: "duty" });

    expect(listDutyHistory).toHaveBeenCalledTimes(1);
    expect(listFlightLogs).not.toHaveBeenCalled();
    expect(screen.getByText("9.5h")).toBeInTheDocument();
    expect(screen.getByText("OPEN")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument(); // status badge
  });

  it("passes a custom date range straight through to listFlightLogs", async () => {
    listFlightLogs.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ from: "2026-01-01", to: "2026-03-31" });

    expect(listFlightLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        fromDate: "2026-01-01",
        toDate: "2026-03-31",
      }),
    );
  });

  it("falls back to the default range when URL params are malformed", async () => {
    listFlightLogs.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ from: "not-a-date", to: "garbage" });

    const call = listFlightLogs.mock.calls[0][0];
    expect(call.fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(call.toDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(call.fromDate).not.toBe("not-a-date");
  });

  it("renders an empty-state when there are no logs in the range", async () => {
    listFlightLogs.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText(/no flight logs/i)).toBeInTheDocument();
  });

  it("renders the session-expired message on 401", async () => {
    listFlightLogs.mockRejectedValueOnce(
      new TestApiError(401, "/ops/flight-logs", "Unauthorized"),
    );

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/session expired/i);
  });

  it("renders the generic unavailable message on 5xx", async () => {
    listFlightLogs.mockRejectedValueOnce(
      new TestApiError(502, "/ops/flight-logs", "Bad Gateway"),
    );

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });

  it("tab nav preserves the date range across tab switches", async () => {
    listFlightLogs.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ from: "2026-04-01", to: "2026-04-30" });

    const tabs = screen.getByRole("tablist");
    const dutyTab = within(tabs).getByRole("tab", { name: "Duty" });
    const href = dutyTab.getAttribute("href") ?? "";
    expect(href).toMatch(/tab=duty/);
    expect(href).toMatch(/from=2026-04-01/);
    expect(href).toMatch(/to=2026-04-30/);
  });
});
