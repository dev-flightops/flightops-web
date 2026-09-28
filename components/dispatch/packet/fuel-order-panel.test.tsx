import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";
import type { FlightDetail, FuelSupplierBaseResponse } from "@/lib/api/types";

const { TestApiError, listSupplierBases } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, listSupplierBases: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ listSupplierBases }));

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

describe("FuelOrderPanel's fields", () => {
  // Labels sat beside their controls unlinked: the supplier select and
  // the price and time inputs had no accessible name.
  it("are each named by their label", async () => {
    listSupplierBases.mockResolvedValue({ items: [ROW], total: 1 });
    const { container } = render(await FuelOrderPanel({ flight: FLIGHT }));
    for (const name of [
      "Fuel Type",
      "Supplier",
      "Contract Price",
      "Gallons",
      "Requested Time",
      "Special Instructions",
    ]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Supplier")).toHaveDisplayValue("Arctic Fuel");
    await expectNoA11yViolations(container);
  });
});
