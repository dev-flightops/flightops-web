import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listSquawks, TestApiError } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { listSquawks: vi.fn(), TestApiError };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/maintenance", () => ({ listSquawks }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./misc-actions", () => ({
  updateMiscAction: vi.fn(),
}));

import { MiscTab } from "./misc-tab";
import type { FlightLogResponse, SquawkResponse } from "@/lib/api/types";

function makeLog(over: Partial<FlightLogResponse> = {}): FlightLogResponse {
  return {
    id: "log-1",
    log_number: "LOG-20260615-150000",
    aircraft: {
      id: "ac-1",
      tail_number: "N207GE",
      model: "C208",
      seats: 9,
      airframe_type: "caravan",
    },
    flight_id: null,
    flight_number: null,
    flight_type: "advisory",
    flight_date: "2026-06-15",
    status: "draft",
    is_manual_entry: false,
    created_by: { id: "u-1", full_name: "Pilot", email: "p@x.test" },
    created_at: "2026-06-15T12:00:00Z",
    vor_identifier: null,
    vor_check_type: null,
    vor_station_facility: null,
    vor_location: null,
    vor_bearing_indicated: null,
    vor_bearing_known: null,
    vor_error_degrees: null,
    vor_checked_at: null,
    vor_certified: false,
    mx_discrepancy: null,
    ...over,
  };
}

function makeSquawk(
  over: Partial<SquawkResponse> & { id: string },
): SquawkResponse {
  return {
    aircraft: {
      id: "ac-1",
      tail_number: "N207GE",
      model: "C208",
    },
    reported_at: "2026-06-10T12:34:00Z",
    reported_by: { id: "u-1", full_name: "Pilot", email: "p@x.test" },
    title: "Cabin door light intermittent",
    description: "Cabin door light flickers on rollout.",
    severity: "minor",
    status: "open",
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    ...over,
  };
}

async function renderTab(over: Partial<FlightLogResponse> = {}) {
  const ui = await MiscTab({ log: makeLog(over) });
  return render(ui);
}

beforeEach(() => {
  listSquawks.mockReset();
});

describe("MiscTab", () => {
  it("renders the MX Discrepancy textarea pre-filled with log.mx_discrepancy", async () => {
    listSquawks.mockResolvedValueOnce({ items: [], total: 0 });

    await renderTab({ mx_discrepancy: "Aft cabin door light flickers." });

    const ta = screen.getByLabelText(/MX Discrepancy/i) as HTMLTextAreaElement;
    expect(ta.value).toBe("Aft cabin door light flickers.");
    expect(
      screen.getByText(/auto-creates a work order in maintenance on submit/i),
    ).toBeInTheDocument();
  });

  it("disables the textarea in submitted mode", async () => {
    listSquawks.mockResolvedValueOnce({ items: [], total: 0 });

    await renderTab({ status: "submitted" });

    expect(screen.getByLabelText(/MX Discrepancy/i)).toBeDisabled();
  });

  it("queries listSquawks for this aircraft, limit 10", async () => {
    listSquawks.mockResolvedValueOnce({ items: [], total: 0 });

    await renderTab();

    expect(listSquawks).toHaveBeenCalledWith({
      aircraftId: "ac-1",
      limit: 10,
    });
  });

  it("renders the empty MX history state with the tail number", async () => {
    listSquawks.mockResolvedValueOnce({ items: [], total: 0 });

    await renderTab();

    expect(
      screen.getByText(/no squawks on file for/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText("N207GE").length).toBeGreaterThan(0);
  });

  it("renders the history list with date + title + status badge", async () => {
    listSquawks.mockResolvedValueOnce({
      items: [
        makeSquawk({
          id: "s-1",
          title: "Cabin door light intermittent",
          reported_at: "2026-06-10T12:34:00Z",
          status: "open",
        }),
        makeSquawk({
          id: "s-2",
          title: "Pitot heat slow to come on",
          reported_at: "2026-05-21T09:00:00Z",
          status: "resolved",
        }),
      ],
      total: 2,
    });

    await renderTab();

    expect(screen.getByText(/last 10/i)).toBeInTheDocument();
    expect(screen.getByText(/Cabin door light intermittent/)).toBeInTheDocument();
    expect(screen.getByText(/Pitot heat slow to come on/)).toBeInTheDocument();
    // Date column shows MM-DD slice of reported_at.
    expect(screen.getByText("06-10")).toBeInTheDocument();
    expect(screen.getByText("05-21")).toBeInTheDocument();
    // Status badges visible.
    expect(screen.getByText(/^open$/i)).toBeInTheDocument();
    expect(screen.getByText(/^resolved$/i)).toBeInTheDocument();
  });

  it("renders the 401 message when listSquawks throws Unauthorized", async () => {
    listSquawks.mockRejectedValueOnce(
      new TestApiError(401, "/maintenance/squawks", "Unauthorized"),
    );

    await renderTab();

    expect(screen.getByRole("alert")).toHaveTextContent(/sign in/i);
  });

  it("renders the generic unavailable message on 5xx", async () => {
    listSquawks.mockRejectedValueOnce(
      new TestApiError(502, "/maintenance/squawks", "Bad Gateway"),
    );

    await renderTab();

    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });
});
