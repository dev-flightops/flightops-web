import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";
import type { FuelOrderResponse } from "@/lib/api/types";
import type { FuelSupplierOption } from "@/lib/fuel";

const { orderFuelForFlightAction, amendFuelOrderAction, cancelFuelOrderAction } = vi.hoisted(
  () => ({
    orderFuelForFlightAction: vi.fn(),
    amendFuelOrderAction: vi.fn(),
    cancelFuelOrderAction: vi.fn(),
  }),
);
vi.mock("./flight-fuel-actions", () => ({
  orderFuelForFlightAction,
  amendFuelOrderAction,
  cancelFuelOrderAction,
}));

import { FlightFuel } from "./flight-fuel";

const OPTIONS: FuelSupplierOption[] = [
  {
    key: "sb-1",
    supplierId: "s-1",
    supplierName: "Arctic Fuel",
    fuelTypeId: "ft-1",
    fuelTypeLabel: "Jet A",
    pricePerGallon: 6,
    isContract: true,
    isDefault: true,
  },
  {
    key: "sb-2",
    supplierId: "s-2",
    supplierName: "Tundra Fuels",
    fuelTypeId: "ft-1",
    fuelTypeLabel: "Jet A",
    pricePerGallon: 6.4,
    isContract: false,
    isDefault: false,
  },
];

function order(over: Partial<FuelOrderResponse> = {}): FuelOrderResponse {
  return {
    id: "o-1",
    n_number: "N208PA",
    base_code: "PANC",
    flight_id: "f-1",
    requested_fuel_date: "2026-09-27",
    requested_fuel_time: "2026-09-27T15:30:00Z",
    supplier: { id: "s-1", name: "Arctic Fuel" },
    fuel_type: { id: "ft-1", code: "jet_a", label: "Jet A" },
    requested_quantity_gallons: 80,
    status: "confirmed",
    requested_by: { id: "u-1", full_name: "Dee Dispatcher", email: "d@x.test" },
    actual_quantity_gallons: null,
    special_instructions: null,
    ...over,
  } as FuelOrderResponse;
}

function renderFuel(orders: FuelOrderResponse[] = [], options = OPTIONS) {
  return render(
    <FlightFuel
      flightId="f-1"
      flightNumber="PGR900"
      base="PANC"
      source="pilot"
      orders={orders}
      options={options}
      fuelTypeCode="JET-A"
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  orderFuelForFlightAction.mockResolvedValue({ ok: true });
  amendFuelOrderAction.mockResolvedValue({ ok: true });
  cancelFuelOrderAction.mockResolvedValue({ ok: true });
});

describe("FlightFuel", () => {
  it("shows what dispatch already ordered, and where it stands", () => {
    renderFuel([order()]);
    const row = screen.getByRole("listitem");
    // Needed-by on the departure base's clock (#68): 15:30Z is 07:30 AKDT.
    expect(row).toHaveTextContent("confirmed80 galJet A· Arctic Fuel· by 07:30 AKDT");
    expect(row).toHaveTextContent("Ordered by Dee Dispatcher");
    expect(screen.getByRole("button", { name: "Order more fuel" })).toBeInTheDocument();
  });

  it("lists open orders before finished ones", () => {
    // Newest first from the API: a cancelled order placed after the
    // live one sat above it on the pilot's preflight.
    renderFuel([
      order({ id: "o-2", status: "cancelled", requested_quantity_gallons: 20 }),
      order({ id: "o-3", status: "fueled", requested_quantity_gallons: 60 }),
      order({ id: "o-1", status: "ordered", requested_quantity_gallons: 180 }),
    ]);
    const rows = screen.getAllByRole("listitem").map((r) => r.textContent);
    expect(rows[0]).toContain("180 gal");
    expect(rows[1]).toContain("60 gal");
    expect(rows[2]).toContain("20 gal");
  });

  it("orders fuel for the flight without leaving the page", async () => {
    const user = userEvent.setup();
    renderFuel();
    expect(screen.getByText("No fuel ordered for PGR900 yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Order fuel" }));
    const form = screen.getByRole("form", { name: "Order fuel" });
    await user.selectOptions(within(form).getByLabelText("Supplier"), "sb-2");
    // A load balanced unevenly, as the client's pilots order it (#69).
    await user.type(within(form).getByLabelText("Left gal"), "55");
    await user.type(within(form).getByLabelText("Right gal"), "75");
    expect(form).toHaveTextContent("Total 130 gal");
    await user.click(within(form).getByRole("button", { name: "Place order" }));
    await waitFor(() => expect(orderFuelForFlightAction).toHaveBeenCalled());
    expect(orderFuelForFlightAction.mock.calls[0][0]).toMatchObject({
      flightId: "f-1",
      source: "pilot",
      supplierId: "s-2",
      fuelTypeId: "ft-1",
      left: 55,
      right: 75,
    });
    await waitFor(() => expect(screen.queryByRole("form", { name: "Order fuel" })).toBeNull());
  });

  it("shows an order's split by side", () => {
    renderFuel([order({ requested_left_gallons: 40, requested_right_gallons: 40 })]);
    expect(screen.getByRole("listitem")).toHaveTextContent("80 gal40 L / 40 R");
  });

  it("adjusts an open order by side, with the reason", async () => {
    const user = userEvent.setup();
    renderFuel([order({ requested_left_gallons: 40, requested_right_gallons: 40 })]);
    await user.click(screen.getByRole("button", { name: "Adjust" }));
    for (const label of ["Left gal", "Right gal"]) {
      const side = screen.getByLabelText(label);
      expect(side).toHaveValue(40);
      await user.clear(side);
      await user.type(side, "60");
    }
    await user.type(screen.getByLabelText("Why (optional)"), "extra for weather");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(amendFuelOrderAction).toHaveBeenCalledWith({
        flightId: "f-1",
        orderId: "o-1",
        source: "pilot",
        left: 60,
        right: 60,
        note: "extra for weather",
      }),
    );
  });

  it("asks for each side when adjusting an order placed as a total", async () => {
    const user = userEvent.setup();
    renderFuel([order()]);
    await user.click(screen.getByRole("button", { name: "Adjust" }));
    expect(screen.getByLabelText("Left gal")).toHaveValue(null);
    expect(screen.getByLabelText("Right gal")).toHaveValue(null);
    expect(screen.getByText("Ordered as 80 gal in total; give each side.")).toBeInTheDocument();
  });

  it("cancels only with a reason", async () => {
    const user = userEvent.setup();
    renderFuel([order({ status: "ordered" })]);
    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    const confirm = screen.getByRole("button", { name: "Cancel order" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText("Why cancel"), "Flight cancelled");
    await user.click(confirm);
    await waitFor(() =>
      expect(cancelFuelOrderAction).toHaveBeenCalledWith({
        flightId: "f-1",
        orderId: "o-1",
        source: "pilot",
        reason: "Flight cancelled",
      }),
    );
  });

  it("offers nothing to change on a fueled order", () => {
    renderFuel([order({ status: "fueled", actual_quantity_gallons: 82 })]);
    expect(screen.queryByRole("button", { name: "Adjust" })).toBeNull();
    expect(screen.getByRole("listitem")).toHaveTextContent("fueled 82 gal");
    expect(screen.getByRole("button", { name: "Order fuel" })).toBeInTheDocument();
  });

  it("shows why an order failed", async () => {
    orderFuelForFlightAction.mockResolvedValue({
      ok: false,
      error: "That supplier is inactive — pick another.",
    });
    const user = userEvent.setup();
    renderFuel();
    await user.click(screen.getByRole("button", { name: "Order fuel" }));
    await user.type(screen.getByLabelText("Left gal"), "25");
    await user.type(screen.getByLabelText("Right gal"), "25");
    await user.click(screen.getByRole("button", { name: "Place order" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That supplier is inactive — pick another.",
    );
  });

  it("says when the base has no supplier for this fuel", () => {
    renderFuel([], []);
    expect(screen.getByText(/No supplier is set up for/)).toHaveTextContent(
      "No supplier is set up for PANC · JET-A. Add one in Ground Ops → Fuel → Suppliers.",
    );
    expect(screen.queryByRole("button", { name: /Order/ })).toBeNull();
  });

  it("has no a11y violations with the order form open", async () => {
    const user = userEvent.setup();
    const { container } = renderFuel([order()]);
    await user.click(screen.getByRole("button", { name: "Order more fuel" }));
    await expectNoA11yViolations(container);
  });
});
