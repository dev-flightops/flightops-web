import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  TestApiError,
  listFuelOrders,
  listGseUnits,
  listOpenStationIssues,
  getFlightBoard,
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
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({
  listFuelOrders,
  listGseUnits,
  listOpenStationIssues,
}));
vi.mock("@/lib/api/flight-following", () => ({ getFlightBoard }));

import RampOpsPage from "./page";

beforeEach(() => {
  listFuelOrders.mockReset();
  listGseUnits.mockReset();
  listOpenStationIssues.mockReset();
  getFlightBoard.mockReset();
});

describe("RampOpsPage (M2)", () => {
  it("renders the five stat tiles and four cards", async () => {
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
                  fuel_type_label_snapshot: "Jet A",
                  requested_quantity_gallons: 100,
                  status: "ordered",
                  requested_at: "2026-06-15T10:00:00Z",
                },
              ]
            : [],
        total: status === "ordered" ? 3 : 1,
      }),
    );
    listGseUnits.mockResolvedValueOnce({
      items: [
        {
          id: "u-1",
          name: "Tug Alpha",
          equipment_type: "tug",
          status: "out_of_service",
          station: { id: "s-1", name: "Main Hangar" },
          open_squawk_count: 1,
        },
      ],
      total: 1,
    });
    listOpenStationIssues.mockResolvedValueOnce({
      items: [
        {
          id: "i-1",
          title: "Frozen fuel pump",
          priority: "high",
          station: { id: "s-1", icao_code: "PANC", name: "Anchorage" },
        },
      ],
      total: 1,
    });
    getFlightBoard.mockResolvedValueOnce({
      items: [
        {
          id: "f-1",
          flight_number: "PER123",
          aircraft: { id: "a-1", tail_number: "N207GE", model: "C208", seats: 9 },
          origin: "PANC",
          destination: "PAAQ",
          scheduled_departure_at: "2026-06-15T18:00:00Z",
          scheduled_arrival_at: "2026-06-15T19:00:00Z",
          actual_departure_at: null,
          actual_arrival_at: null,
          status: "scheduled",
          pax_count: 4,
          cargo_lbs: 200,
          pic_name: null,
          is_overdue: false,
          last_contact_at: null,
        },
      ],
      view: "today",
      total: 1,
    });

    const ui = await RampOpsPage();
    render(ui);

    expect(
      screen.getByRole("heading", { name: /^ramp ops$/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/awaiting confirm/i)).toBeInTheDocument();
    expect(screen.getByText("Tug Alpha")).toBeInTheDocument();
    expect(screen.getByText("Frozen fuel pump")).toBeInTheDocument();
    expect(screen.getByText("PER123")).toBeInTheDocument();
  });

  it("renders an aggregated error banner if one fetch fails", async () => {
    listFuelOrders.mockResolvedValue({ items: [], total: 0 });
    listGseUnits.mockResolvedValueOnce({ items: [], total: 0 });
    listOpenStationIssues.mockRejectedValueOnce(
      new TestApiError(500, "/x", "x"),
    );
    getFlightBoard.mockResolvedValueOnce({
      items: [],
      view: "today",
      total: 0,
    });

    const ui = await RampOpsPage();
    render(ui);

    expect(screen.getByRole("alert")).toHaveTextContent(/station issues/i);
  });

  it("shows session-expired text when any fetch returns 401", async () => {
    listFuelOrders.mockResolvedValue({ items: [], total: 0 });
    listGseUnits.mockResolvedValueOnce({ items: [], total: 0 });
    listOpenStationIssues.mockResolvedValueOnce({ items: [], total: 0 });
    getFlightBoard.mockRejectedValueOnce(new TestApiError(401, "/b", "expired"));

    const ui = await RampOpsPage();
    render(ui);

    expect(screen.getByRole("alert")).toHaveTextContent(/session expired/i);
  });
});
