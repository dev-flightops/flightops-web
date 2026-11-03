import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  TestApiError,
  listFuelOrders,
  listGseUnits,
  listOpenStationIssues,
  getFlightBoard,
  listMyTeamLoads,
  loadZoneTable,
} = vi.hoisted(() => {
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
    listFuelOrders: vi.fn(),
    listGseUnits: vi.fn(),
    listOpenStationIssues: vi.fn(),
    getFlightBoard: vi.fn(),
    listMyTeamLoads: vi.fn(),
    loadZoneTable: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({
  listFuelOrders,
  listGseUnits,
  listOpenStationIssues,
  listMyTeamLoads,
}));
vi.mock("@/lib/api/flight-following", () => ({ getFlightBoard }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable }));
vi.mock("@/components/load-teams/load-status-actions", () => ({
  acknowledgeLoadAction: vi.fn(),
  completeLoadAction: vi.fn(),
  reopenLoadAction: vi.fn(),
}));

import RamperPage from "./page";

beforeEach(() => {
  listFuelOrders.mockReset();
  listGseUnits.mockReset();
  listOpenStationIssues.mockReset();
  getFlightBoard.mockReset();
  // Sane defaults — individual tests override.
  listFuelOrders.mockResolvedValue({ items: [], total: 0 });
  listGseUnits.mockResolvedValue({ items: [], total: 0 });
  listOpenStationIssues.mockResolvedValue({ items: [], total: 0 });
  getFlightBoard.mockResolvedValue({ items: [], view: "today", total: 0 });
  listMyTeamLoads.mockReset();
  listMyTeamLoads.mockResolvedValue({ items: [], total: 0 });
  loadZoneTable.mockResolvedValue({ byIcao: {}, fallback: "America/Anchorage" });
});

describe("RamperPage — the team's loads (#134)", () => {
  const load = (over: Record<string, unknown> = {}) => ({
    id: "as-1",
    flight: {
      id: "fl-1",
      flight_number: "DEMO104",
      origin: "PANC",
      destination: "PABE",
      scheduled_departure_at: "2026-11-03T13:05:00Z",
      status: "released",
      tail_number: "N94DM",
      pax_count: 3,
    },
    load_team: { id: "lt-1", team_name: "Anchorage Load Team A", base_icao: "PANC", color_code: "#60a5fa" },
    assigned_by: null,
    assigned_at: "2026-11-03T11:45:00Z",
    cleared_at: null,
    cleared_by: null,
    note: null,
    acknowledged_at: null,
    acknowledged_by: null,
    load_completed_at: null,
    load_completed_by: null,
    photo_count: 0,
    crew_user_ids: [],
    ...over,
  });

  it("lists each load with its next step", async () => {
    listMyTeamLoads.mockResolvedValueOnce({ items: [load()], total: 1 });
    render(await RamperPage());
    expect(screen.getByText(/DEMO104 • PANC → PABE/)).toBeInTheDocument();
    expect(screen.getByText("Not acknowledged")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Acknowledge the load for DEMO104/ })).toBeInTheDocument();
  });

  it("shows a completed load with who and when, and offers Reopen", async () => {
    listMyTeamLoads.mockResolvedValueOnce({
      items: [
        load({
          acknowledged_at: "2026-11-03T11:47:00Z",
          load_completed_at: "2026-11-03T11:58:00Z",
          load_completed_by: { id: "u-1", full_name: "Nina Brightwater", email: "n@x" },
          photo_count: 1,
        }),
      ],
      total: 1,
    });
    render(await RamperPage());
    expect(screen.getByText("Load complete")).toBeInTheDocument();
    expect(screen.getByText(/02:58 AKST · by Nina Brightwater · 1 photo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reopen the load for DEMO104/ })).toBeInTheDocument();
  });

  it("keeps a released flight that hasn't left on the departing list", async () => {
    getFlightBoard.mockResolvedValueOnce({
      items: [
        {
          id: "fl-2",
          flight_number: "DEMO105",
          origin: "PANC",
          destination: "PAII",
          status: "released",
          actual_departure_at: null,
          scheduled_departure_at: "2026-11-03T14:35:00Z",
          pax_count: 0,
          aircraft: { tail_number: "N95DM" },
        },
      ],
      view: "today",
      total: 1,
    });
    render(await RamperPage());
    expect(screen.getByText(/DEMO105 • PANC → PAII/)).toBeInTheDocument();
  });
});

describe("RamperPage (M2)", () => {
  it("renders the worklist sections and total task count", async () => {
    listFuelOrders.mockImplementation(({ status }: { status: string }) =>
      Promise.resolve({
        items:
          status === "ordered"
            ? [
                {
                  id: "o-1",
                  n_number: "N207GE",
                  base_code: "PANC",
                  supplier_name_snapshot: "Crowley",
                  requested_quantity_gallons: 100,
                },
              ]
            : [],
        total: status === "ordered" ? 1 : 0,
      }),
    );
    listGseUnits.mockResolvedValueOnce({
      items: [
        {
          id: "u-1",
          name: "GPU Bravo",
          equipment_type: "gpu",
          status: "operational",
          station: { id: "s-1", name: "Main Hangar" },
          open_squawk_count: 2,
        },
        {
          id: "u-2",
          name: "Tug Charlie",
          equipment_type: "tug",
          status: "operational",
          station: null,
          open_squawk_count: 0, // should NOT appear
        },
      ],
      total: 2,
    });

    const ui = await RamperPage();
    render(ui);

    expect(
      screen.getByRole("heading", { name: /^ramper$/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^confirm fuel orders/i)).toBeInTheDocument();
    expect(screen.getByText(/N207GE @ PANC/)).toBeInTheDocument();
    // Equipment with squawks: GPU shows, Tug does not (0 squawks)
    expect(screen.getByText("GPU Bravo")).toBeInTheDocument();
    expect(screen.queryByText("Tug Charlie")).not.toBeInTheDocument();
  });

  it("renders empty-state hints when there are no open tasks", async () => {
    const ui = await RamperPage();
    render(ui);

    expect(
      screen.getByText(/no orders waiting for supplier confirmation/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no flights scheduled to depart today/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no gse units have open squawks/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no open station issues/i),
    ).toBeInTheDocument();
  });

  it("shows the session-expired alert on 401", async () => {
    listFuelOrders.mockReset();
    listFuelOrders.mockRejectedValueOnce(
      new TestApiError(401, "/orders", "expired"),
    );
    listFuelOrders.mockResolvedValueOnce({ items: [], total: 0 });

    const ui = await RamperPage();
    render(ui);

    expect(screen.getByRole("alert")).toHaveTextContent(/session expired/i);
  });
});
