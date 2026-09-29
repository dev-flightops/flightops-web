import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";
import type { FlightDetail, FuelSupplierBaseResponse } from "@/lib/api/types";

const { TestApiError, listSupplierBases, listFuelOrders } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, listSupplierBases: vi.fn(), listFuelOrders: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ listSupplierBases, listFuelOrders }));
vi.mock("@/components/fuel/flight-fuel-actions", () => ({
  orderFuelForFlightAction: vi.fn(),
  amendFuelOrderAction: vi.fn(),
  cancelFuelOrderAction: vi.fn(),
}));

import { FuelOrderPanel } from "./fuel-order-panel";

const FLIGHT = {
  id: "f-1",
  flight_number: "PGR900",
  origin: "PANC",
  destination: "PABE",
  status: "scheduled",
  aircraft: { id: "ac-1", tail_number: "N208PA", model: "Cessna 208B", seats: 9 },
} as FlightDetail;

const ROW: FuelSupplierBaseResponse = {
  id: "sb-1",
  supplier_id: "s-1",
  supplier_name: "Arctic Fuel",
  base_code: "PANC",
  fuel_type_id: "ft-1",
  fuel_type_code: "jet_a",
  fuel_type_label: "Jet A",
  price_per_gallon: 6,
  is_contract_rate: true,
  effective_from: null,
  effective_to: null,
  is_default: true,
  notes: null,
  is_active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  listSupplierBases.mockResolvedValue({ items: [ROW], total: 1 });
  listFuelOrders.mockResolvedValue({ items: [], total: 0 });
});

describe("the packet's Fuel panel", () => {
  it("reads this flight's orders", async () => {
    render(await FuelOrderPanel({ flight: FLIGHT }));
    expect(listFuelOrders).toHaveBeenCalledWith({ flightId: "f-1" });
    expect(screen.getByText("Arctic Fuel")).toBeInTheDocument();
    expect(screen.getByText("$6.00 / gal contract")).toBeInTheDocument();
  });

  it("orders on the packet instead of sending the dispatcher away", async () => {
    // The client, 27 Sep: "fuel ordering takes you to a different page
    // and then you lose all your work on the dispatch page".
    const user = userEvent.setup();
    const { container } = render(await FuelOrderPanel({ flight: FLIGHT }));
    expect(container.querySelector('a[href="/fuel/orders/new"]')).toBeNull();
    expect(screen.queryByText(/pricing only/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Order fuel" }));
    // Every field in the form is named by its label.
    for (const name of ["Supplier", "Gallons", "Needed by (UTC, optional)", "Special instructions (optional)"]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
    await expectNoA11yViolations(container);
  });

  it("says when fuel can't be read", async () => {
    listFuelOrders.mockRejectedValue(new TestApiError(500, "/x", ""));
    render(await FuelOrderPanel({ flight: FLIGHT }));
    expect(screen.getByRole("alert")).toHaveTextContent("Fuel unavailable");
  });
});
