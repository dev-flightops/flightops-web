import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, auth, listFuelTypes } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, auth: vi.fn(), listFuelTypes: vi.fn() };
});
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ listFuelTypes }));
vi.mock("@/components/fuel/fuel-type-controls", () => ({
  AddFuelTypeForm: () => <p>add a fuel type form</p>,
  FuelTypeSwitch: ({ label, active }: { label: string; active: boolean }) => (
    <button type="button">{`${active ? "off" : "on"}: ${label}`}</button>
  ),
}));

import FuelTypesPage from "./page";

const JET = { id: "ft-1", code: "JET_A", label: "Jet A", is_active: true, sort_order: 10 };
const MOGAS = { id: "ft-2", code: "MOGAS", label: "Mogas", is_active: false, sort_order: 90 };

beforeEach(() => {
  vi.clearAllMocks();
  listFuelTypes.mockResolvedValue({ items: [JET, MOGAS] });
});

describe("FuelTypesPage (#134)", () => {
  it("gives the directory's keepers each type's switch and the add form", async () => {
    auth.mockResolvedValue({ roles: ["chief_pilot"] });
    render(await FuelTypesPage());
    expect(within(screen.getByRole("row", { name: /Jet A/ })).getByRole("button", { name: "off: Jet A" })).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Mogas/ })).getByRole("button", { name: "on: Mogas" })).toBeInTheDocument();
    expect(screen.getByText("add a fuel type form")).toBeInTheDocument();
  });

  it("shows the catalog alone to anyone else", async () => {
    auth.mockResolvedValue({ roles: ["dispatcher"] });
    render(await FuelTypesPage());
    expect(screen.getByText("Jet A")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("add a fuel type form")).toBeNull();
  });

  it("says who adds them when there are none, with no API hint", async () => {
    auth.mockResolvedValue({ roles: ["pilot"] });
    listFuelTypes.mockResolvedValue({ items: [] });
    render(await FuelTypesPage());
    expect(screen.getByText(/the Director of Operations or an Exec Admin adds them/)).toBeInTheDocument();
    expect(screen.queryByText(/POST \/ground/)).toBeNull();
  });
});
