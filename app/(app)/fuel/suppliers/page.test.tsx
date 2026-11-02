import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, auth, listFuelSuppliers, listSupplierBases, listSupplierLogins } = vi.hoisted(() => {
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
  };
});
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ listFuelSuppliers, listSupplierBases }));
vi.mock("@/lib/api/auth", () => ({ listSupplierLogins }));
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
