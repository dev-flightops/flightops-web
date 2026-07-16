import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FuelOrderResponse } from "@/lib/api/types";

const { TestApiError, listFuelOrders } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, listFuelOrders: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ listFuelOrders }));
vi.mock("./status-filter", () => ({
  OrdersStatusFilter: () => <div data-testid="status-filter" />,
}));

import FuelOrdersPage from "./page";

function makeOrder(overrides: Partial<FuelOrderResponse>): FuelOrderResponse {
  return {
    id: "o-1",
    n_number: "N207GE",
    base_code: "PANC",
    requested_fuel_date: "2026-06-15",
    requested_fuel_time: null,
    supplier: { id: "s-1", name: "Crowley Fuels" },
    fuel_type: { id: "ft-1", code: "JET-A", label: "Jet A" },
    supplier_name_snapshot: "Crowley Fuels",
    fuel_type_label_snapshot: "Jet A",
    price_per_gallon: null,
    requested_quantity_gallons: 100,
    requested_left_gallons: null,
    requested_right_gallons: null,
    special_instructions: null,
    status: "ordered",
    confirmed_at: null,
    confirmed_by_name: null,
    confirmed_note: null,
    fueled_at: null,
    fueled_by_name: null,
    actual_quantity_gallons: null,
    actual_left_gallons: null,
    actual_right_gallons: null,
    discrepancy_reason: null,
    closed_by_source: null,
    cancel_reason: null,
    invoice_pending: false,
    requested_by: { id: "u-1", full_name: "Dispatcher", email: "d@x" },
    requested_at: "2026-06-15T10:00:00Z",
    notification_sent_at: null,
    notification_channel: null,
    notification_to: null,
    notification_subject: null,
    ...overrides,
  };
}

beforeEach(() => {
  listFuelOrders.mockReset();
});

async function renderPage(searchParams: { status?: string } = {}) {
  const ui = await FuelOrdersPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

describe("FuelOrdersPage (M2-G-40)", () => {
  it("renders title + subtitle + Order Fuel CTA", async () => {
    listFuelOrders.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: /fuel orders/i, level: 1 }),
    ).toBeInTheDocument();
    const ctas = screen.getAllByRole("link", { name: /order fuel/i });
    expect(ctas[0]).toHaveAttribute("href", "/fuel/orders/new");
  });

  it("passes the status param to the API client", async () => {
    listFuelOrders.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ status: "confirmed" });

    expect(listFuelOrders).toHaveBeenCalledWith({
      status: "confirmed",
      limit: 200,
    });
  });

  it("ignores unknown status values", async () => {
    listFuelOrders.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ status: "bogus" });

    expect(listFuelOrders).toHaveBeenCalledWith({
      status: undefined,
      limit: 200,
    });
  });

  it("renders one row per order with status chip", async () => {
    listFuelOrders.mockResolvedValueOnce({
      items: [
        makeOrder({ id: "a", n_number: "N207GE", status: "ordered" }),
        makeOrder({ id: "b", n_number: "N510PA", status: "fueled" }),
      ],
      total: 2,
    });

    await renderPage();

    expect(screen.getByText("N207GE")).toBeInTheDocument();
    expect(screen.getByText("N510PA")).toBeInTheDocument();
    const viewLinks = screen.getAllByRole("link", { name: /view/i });
    expect(viewLinks[0]).toHaveAttribute("href", "/fuel/orders/a");
    expect(viewLinks[1]).toHaveAttribute("href", "/fuel/orders/b");
  });

  it("renders the empty state with no filter applied", async () => {
    listFuelOrders.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText(/no fuel orders yet/i)).toBeInTheDocument();
  });

  it("renders the filtered empty state when status is set", async () => {
    listFuelOrders.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ status: "fueled" });

    expect(
      screen.getByText(/no fuel orders with status fueled/i),
    ).toBeInTheDocument();
  });

  it("renders the session-expired alert on 401", async () => {
    listFuelOrders.mockRejectedValueOnce(
      new TestApiError(401, "/ground/fuel/orders", "Unauthorized"),
    );

    await renderPage();

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it("renders the generic error alert on 5xx", async () => {
    listFuelOrders.mockRejectedValueOnce(
      new TestApiError(502, "/ground/fuel/orders", "Bad Gateway"),
    );

    await renderPage();

    expect(
      screen.getByText(/fuel orders unavailable/i),
    ).toBeInTheDocument();
  });
});
