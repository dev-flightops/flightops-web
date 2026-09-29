import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { FlightDetail, FuelOrderResponse } from "@/lib/api/types";

const { orderFuelForFlightAction } = vi.hoisted(() => ({
  orderFuelForFlightAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/components/fuel/flight-fuel-actions", () => ({
  orderFuelForFlightAction,
  amendFuelOrderAction: vi.fn(),
  cancelFuelOrderAction: vi.fn(),
}));

import { PreflightFuel } from "./preflight-fuel";

const FLIGHT = {
  id: "f-1",
  flight_number: "GV203",
  origin: "PABE",
  destination: "PASM",
} as FlightDetail;

const DISPATCH_ORDER = {
  id: "o-1",
  status: "ordered",
  requested_quantity_gallons: 60,
  requested_fuel_time: null,
  fuel_type: { id: "ft-1", code: "jet_a", label: "Jet A" },
  supplier: { id: "s-1", name: "Bethel Fuel" },
  requested_by: { id: "u-1", full_name: "Dee Dispatcher", email: "d@x.test" },
  actual_quantity_gallons: null,
  special_instructions: null,
} as unknown as FuelOrderResponse;

const OPTION = {
  key: "sb-1",
  supplierId: "s-1",
  supplierName: "Bethel Fuel",
  fuelTypeId: "ft-1",
  fuelTypeLabel: "Jet A",
  pricePerGallon: 6.5,
  isContract: true,
  isDefault: true,
};

describe("the pilot's fuel card", () => {
  it("shows what dispatch ordered and lets the pilot order more, as the pilot", async () => {
    // "if dispatch already ordered fuel, pilot needs to see that. The
    // pilot may also want to take additional fuel" (client, 27 Sep).
    const user = userEvent.setup();
    render(
      <PreflightFuel
        flight={FLIGHT}
        orders={[DISPATCH_ORDER]}
        options={[OPTION]}
        fuelTypeCode="JET-A"
        unavailable={null}
      />,
    );
    expect(screen.getByRole("heading", { name: "Fuel" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("Ordered by Dee Dispatcher");
    await user.click(screen.getByRole("button", { name: "Order more fuel" }));
    await user.type(screen.getByLabelText("Gallons"), "20");
    await user.click(screen.getByRole("button", { name: "Place order" }));
    expect(orderFuelForFlightAction).toHaveBeenCalledWith(
      expect.objectContaining({ flightId: "f-1", source: "pilot", gallons: 20 }),
    );
  });

  it("says when fuel can't be read", () => {
    render(
      <PreflightFuel
        flight={FLIGHT}
        orders={[]}
        options={[]}
        fuelTypeCode="JET-A"
        unavailable="Fuel unavailable — try refreshing in a moment."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Fuel unavailable");
  });
});
