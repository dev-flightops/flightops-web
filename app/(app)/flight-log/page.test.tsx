import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AircraftListItem,
  FlightListItem,
  FlightLogResponse,
} from "@/lib/api/types";

const { TestApiError, listFlightLogs, listAircraft, listFlights } =
  vi.hoisted(() => {
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
      listFlightLogs: vi.fn(),
      listAircraft: vi.fn(),
      listFlights: vi.fn(),
    };
  });
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({
  listFlightLogs,
  listAircraft,
  listFlights,
}));

// NewFlightLogForm is a client component using useActionState — stub
// it to a marker. The dedicated actions.test.ts covers the action
// behaviour separately.
vi.mock("./new-flight-log-form", () => ({
  NewFlightLogForm: ({
    aircraft,
    recentFlights,
  }: {
    aircraft: AircraftListItem[];
    recentFlights: FlightListItem[];
  }) => (
    <form
      data-testid="new-log-form"
      data-aircraft-count={aircraft.length}
      data-flight-count={recentFlights.length}
    />
  ),
}));

import FlightLogPage from "./page";

function makeAircraft(
  overrides: Partial<AircraftListItem> & { id: string },
): AircraftListItem {
  return {
    tail_number: "N207GE",
    model: "C208",
    seats: 9,
    max_payload_lbs: 3000,
    is_active: true,
    ...overrides,
  };
}

function makeLog(
  overrides: Partial<FlightLogResponse> & { id: string },
): FlightLogResponse {
  return {
    log_number: `LOG-20260615-${overrides.id}`,
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "C208", seats: 9 },
    flight_id: null,
    flight_number: null,
    flight_type: "advisory",
    flight_date: "2026-06-15",
    status: "draft",
    created_by: { id: "u-1", full_name: "Pilot", email: "p@x" },
    created_at: "2026-06-15T12:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  listFlightLogs.mockReset();
  listAircraft.mockReset();
  listFlights.mockReset();
  // Sensible defaults so each test only mocks what it asserts on.
  listFlightLogs.mockResolvedValue({ items: [], total: 0 });
  listAircraft.mockResolvedValue({
    items: [makeAircraft({ id: "ac-1" })],
    total: 1,
  });
  listFlights.mockResolvedValue({ items: [], total: 0 });
});

async function renderPage() {
  const ui = await FlightLogPage();
  return render(ui);
}

describe("FlightLogPage (M2-G-26b)", () => {
  it("issues three parallel calls (drafts, aircraft, released flights)", async () => {
    await renderPage();

    expect(listFlightLogs).toHaveBeenCalledWith({
      status: "draft",
      limit: 50,
    });
    expect(listAircraft).toHaveBeenCalled();
    expect(listFlights).toHaveBeenCalledWith({
      status: "released",
      limit: 50,
    });
  });

  it("renders the legacy title + today's date subtitle + form", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", {
        name: /electronic flight log/i,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("new-log-form")).toBeInTheDocument();
  });

  it("renders the Active Drafts panel when drafts exist", async () => {
    listFlightLogs.mockResolvedValueOnce({
      items: [
        makeLog({ id: "1" }),
        makeLog({ id: "2", aircraft: { id: "ac-2", tail_number: "N510PA", model: "B1900", seats: 19 } }),
      ],
      total: 2,
    });

    await renderPage();

    expect(screen.getByText(/active logs \(draft\)/i)).toBeInTheDocument();
    expect(screen.getByText("LOG-20260615-1")).toBeInTheDocument();
    expect(screen.getByText("LOG-20260615-2")).toBeInTheDocument();
    expect(screen.getAllByText(/^draft$/i).length).toBeGreaterThanOrEqual(2);
  });

  it("hides the Active Drafts panel entirely when there are no drafts", async () => {
    await renderPage();

    expect(
      screen.queryByText(/active logs \(draft\)/i),
    ).not.toBeInTheDocument();
  });

  it("filters out inactive aircraft before passing to the form", async () => {
    listAircraft.mockResolvedValueOnce({
      items: [
        makeAircraft({ id: "ac-1", is_active: true }),
        makeAircraft({ id: "ac-2", is_active: false }),
      ],
      total: 2,
    });

    await renderPage();

    expect(screen.getByTestId("new-log-form")).toHaveAttribute(
      "data-aircraft-count",
      "1",
    );
  });

  it("renders the empty-state copy when the tenant has no active aircraft", async () => {
    listAircraft.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByText(/no active aircraft on this tenant/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("new-log-form")).not.toBeInTheDocument();
  });

  it("renders the session-expired alert on 401", async () => {
    listFlightLogs.mockRejectedValueOnce(
      new TestApiError(401, "/ops/flight-logs", "Unauthorized"),
    );

    await renderPage();

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it("renders the generic error hint on backend failure", async () => {
    listFlightLogs.mockRejectedValueOnce(
      new TestApiError(502, "/ops/flight-logs", "Bad Gateway"),
    );

    await renderPage();

    expect(screen.getByText(/flight log unavailable/i)).toBeInTheDocument();
  });
});
