import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, auth, listFuelSuppliers, listSupplierBases, listSupplierLogins, listStations, listFuelTypes } = vi.hoisted(() => {
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
    auth: vi.fn(),
    listFuelSuppliers: vi.fn(),
    listSupplierBases: vi.fn(),
    listSupplierLogins: vi.fn(),
    listStations: vi.fn(),
    listFuelTypes: vi.fn(),
  };
});
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ listFuelSuppliers, listSupplierBases, listStations, listFuelTypes }));
vi.mock("@/lib/api/auth", () => ({ listSupplierLogins }));
vi.mock("@/components/fuel/supplier-form", () => ({
  SupplierForm: () => <p>add a supplier form</p>,
  SupplierHeader: ({ supplier, canEdit }: { supplier: { name: string }; canEdit: boolean }) => (
    <h2>{`${supplier.name}${canEdit ? " (editable)" : ""}`}</h2>
  ),
}));
vi.mock("@/components/fuel/supplier-prices", () => ({
  SupplierPrices: ({
    supplierName,
    canEdit,
    stations,
    fuelTypes,
  }: {
    supplierName: string;
    canEdit: boolean;
    stations: { code: string }[] | null;
    fuelTypes: unknown[];
  }) => (
    <p>{`${supplierName} prices${canEdit ? `: stations ${stations ? stations.map((s) => s.code).join(",") : "unreadable"}, ${fuelTypes.length} fuels` : ""}`}</p>
  ),
}));
vi.mock("@/components/fuel/supplier-logins", () => ({
  SupplierLogins: ({ supplierName, logins }: { supplierName: string; logins: unknown[] | null }) => (
    <p>{`${supplierName} logins: ${logins === null ? "unreadable" : logins.length}`}</p>
  ),
}));

import FuelSuppliersPage from "./page";

const SUPPLIER = {
  id: "s-1",
  name: "Tundra Fuel",
  contact_name: null,
  email: "orders@tundrafuel.test",
  phone: null,
  billing_terms: null,
  is_active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  listFuelSuppliers.mockResolvedValue({ items: [SUPPLIER, { ...SUPPLIER, id: "s-2", name: "Bethel Fuel" }] });
  listSupplierBases.mockResolvedValue({ items: [] });
  listStations.mockResolvedValue({ items: [{ icao_code: "pabe", name: "Bethel" }, { icao_code: "PAEM", name: "Emmonak" }] });
  listFuelTypes.mockResolvedValue({ items: [{ id: "ft-jet", label: "Jet A" }] });
});

describe("FuelSuppliersPage: the suppliers' portal logins (#134)", () => {
  it("shows each supplier's logins to the fuel directory's keepers", async () => {
    auth.mockResolvedValue({ roles: ["chief_pilot", "pilot"] });
    listSupplierLogins.mockImplementation(async (id: string) => {
      if (id === "s-2") throw new TestApiError(502, "/auth/x", "Bad Gateway");
      return { items: [{ id: "b-1" }] };
    });
    render(await FuelSuppliersPage());
    expect(listSupplierLogins).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Tundra Fuel logins: 1")).toBeInTheDocument();
    expect(screen.getByText("Bethel Fuel logins: unreadable")).toBeInTheDocument();
  });

  it("asks nothing and shows nothing to anyone else", async () => {
    auth.mockResolvedValue({ roles: ["dispatcher"] });
    render(await FuelSuppliersPage());
    expect(listSupplierLogins).not.toHaveBeenCalled();
    expect(screen.queryByText(/logins:/)).toBeNull();
    expect(screen.getByText("Tundra Fuel")).toBeInTheDocument();
  });
});

describe("FuelSuppliersPage: the directory kept in the web (#134)", () => {
  it("gives its keepers the add form, editable suppliers and what a price is set for", async () => {
    auth.mockResolvedValue({ roles: ["director_of_maintenance"] });
    listSupplierLogins.mockResolvedValue({ items: [] });
    render(await FuelSuppliersPage());
    expect(screen.getByText("add a supplier form")).toBeInTheDocument();
    expect(screen.getByText("Tundra Fuel (editable)")).toBeInTheDocument();
    expect(screen.getByText("Tundra Fuel prices: stations PABE,PAEM, 1 fuels")).toBeInTheDocument();
  });

  it("types the base when the stations can't be read", async () => {
    auth.mockResolvedValue({ roles: ["exec_admin"] });
    listSupplierLogins.mockResolvedValue({ items: [] });
    listStations.mockRejectedValue(new TestApiError(502, "/ground/stations", "Bad Gateway"));
    render(await FuelSuppliersPage());
    expect(screen.getByText("Tundra Fuel prices: stations unreadable, 1 fuels")).toBeInTheDocument();
  });

  it("shows the directory as it is to anyone else, with no API hint", async () => {
    auth.mockResolvedValue({ roles: ["pilot"] });
    listFuelSuppliers.mockResolvedValue({ items: [] });
    render(await FuelSuppliersPage());
    expect(listStations).not.toHaveBeenCalled();
    expect(screen.queryByText("add a supplier form")).toBeNull();
    expect(screen.getByText(/the Director of Operations or an Exec Admin adds them/)).toBeInTheDocument();
    expect(screen.queryByText(/POST \/ground/)).toBeNull();
  });
});
