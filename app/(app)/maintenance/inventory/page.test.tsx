import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Part } from "@/lib/api/maintenance";

const { TestApiError, listParts, listPartCategories, auth } = vi.hoisted(() => {
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
    listParts: vi.fn(),
    listPartCategories: vi.fn(),
    auth: vi.fn(async () => ({ roles: ["maintenance"] as string[] })),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/maintenance", () => ({ listParts, listPartCategories }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("./barcode-scan", () => ({ BarcodeScan: () => <div data-testid="barcode-scan" /> }));

import InventoryPage from "./page";

function part(over: Partial<Part> = {}): Part {
  return {
    id: "p-1",
    part_number: "CH48110-1",
    description: "Oil filter",
    category: "consumable",
    manufacturer: null,
    unit_cost: 12.5,
    unit: "EA",
    qty_on_hand: 8,
    qty_minimum: 2,
    low_stock: false,
    location: "PABE bin 4",
    is_life_limited: false,
    shelf_life_months: null,
    expiration_date: null,
    expired: false,
    batch_number: null,
    lot_number: null,
    received_date: null,
    is_active: true,
    notes: null,
    ...over,
  };
}

async function show(params: Record<string, string> = {}) {
  render(await InventoryPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  auth.mockResolvedValue({ roles: ["maintenance"] });
  listPartCategories.mockResolvedValue([
    { value: "consumable", label: "Consumable" },
    { value: "hardware", label: "Hardware" },
  ]);
  listParts.mockReset();
});

describe("Parts Inventory (#172)", () => {
  it("lists the parts, with legacy's columns", async () => {
    listParts.mockResolvedValue({ items: [part()], total: 1, low_count: 0 });
    await show();
    const row = screen.getByRole("row", { name: /CH48110-1/ });
    expect(within(row).getByText("Oil filter")).toBeInTheDocument();
    expect(within(row).getByText("Consumable")).toBeInTheDocument();
    expect(within(row).getByText("PABE bin 4")).toBeInTheDocument();
    expect(within(row).getByText("$12.50")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: /Open CH48110-1/ })).toHaveAttribute("href", "/maintenance/inventory/p-1");
    expect(screen.getByText("1 part")).toBeInTheDocument();
  });

  it("counts low stock and reads the quantity red", async () => {
    listParts.mockResolvedValue({ items: [part({ qty_on_hand: 2, qty_minimum: 5, low_stock: true })], total: 1, low_count: 1 });
    await show();
    expect(screen.getByText(/1 low stock/)).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /CH48110-1/ });
    expect(within(row).getByText("2").className).toContain("text-status-red");
  });

  it("marks an expired part", async () => {
    listParts.mockResolvedValue({ items: [part({ expired: true })], total: 1, low_count: 0 });
    await show();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("passes the filters on and keeps them in the form", async () => {
    listParts.mockResolvedValue({ items: [], total: 0, low_count: 0 });
    await show({ q: "oil", category: "hardware", low_stock: "1" });
    expect(listParts).toHaveBeenCalledWith({ q: "oil", category: "hardware", lowStock: true });
    expect(screen.getByLabelText("Search")).toHaveValue("oil");
    expect(screen.getByLabelText("Category")).toHaveValue("hardware");
    expect(screen.getByLabelText("Low stock only")).toBeChecked();
    expect(screen.getByText("No parts match.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add First Part" })).not.toBeInTheDocument();
  });

  it("starts an empty inventory", async () => {
    listParts.mockResolvedValue({ items: [], total: 0, low_count: 0 });
    await show();
    expect(screen.getByRole("link", { name: "Add First Part" })).toHaveAttribute("href", "/maintenance/inventory/new");
  });

  it("gives the shop the scanner and the add button, and others neither", async () => {
    listParts.mockResolvedValue({ items: [], total: 0, low_count: 0 });
    await show();
    expect(screen.getByTestId("barcode-scan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ Add Part" })).toBeInTheDocument();

    document.body.innerHTML = "";
    auth.mockResolvedValue({ roles: ["dispatcher"] });
    await show();
    expect(screen.queryByTestId("barcode-scan")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "+ Add Part" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add First Part" })).not.toBeInTheDocument();
  });

  it("links the two reports", async () => {
    listParts.mockResolvedValue({ items: [], total: 0, low_count: 0 });
    await show();
    expect(screen.getByRole("link", { name: "Expiration" })).toHaveAttribute("href", "/maintenance/expiration");
    expect(screen.getByRole("link", { name: "Batch Trace" })).toHaveAttribute("href", "/maintenance/batch-trace");
  });

  it("says so when it can't load", async () => {
    listParts.mockRejectedValue(new TestApiError(500, "/parts", "boom"));
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("unavailable");
  });
});
