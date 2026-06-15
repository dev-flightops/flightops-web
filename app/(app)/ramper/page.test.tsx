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
