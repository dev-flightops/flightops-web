import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/ground", () => ({
  listFuelOrders: vi.fn(async () => ({ items: [], total: 2 })),
  listFuelSuppliers: vi.fn(async () => ({ items: [], total: 2 })),
  listFuelTypes: vi.fn(async () => ({ items: [], total: 4 })),
  listFuelQualityTests: vi.fn(async () => ({ items: [], total: 40 })),
}));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));

import FuelLandingPage from "./page";

describe("the fuel landing page", () => {
  it("links the quality log and counts its tests", async () => {
    render(await FuelLandingPage());
    // It showed "—" for the quality logs, with no way in from here.
    expect(screen.getByRole("link", { name: /Quality Log/ })).toHaveAttribute("href", "/fuel/quality");
    expect(screen.getByText("40 tests logged")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
});
