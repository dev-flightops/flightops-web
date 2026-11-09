import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MxVendor } from "@/lib/api/mx-vendors";

const { TestApiError, listVendors, auth } = vi.hoisted(() => {
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
    listVendors: vi.fn(),
    auth: vi.fn(async () => ({ roles: ["maintenance"] as string[] })),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/mx-vendors", () => ({ listVendors }));
vi.mock("@/auth", () => ({ auth }));

import VendorsPage from "./page";

function vendor(over: Partial<MxVendor> = {}): MxVendor {
  return {
    id: "v-1",
    name: "Northern Prop",
    vendor_type: "prop",
    type_label: "Prop Shop",
    contact_name: "Sam",
    phone: "907-555-0100",
    email: "sam@northernprop.test",
    address: null,
    faa_cert: "N2PR123K",
    notes: null,
    is_active: true,
    ...over,
  };
}

beforeEach(() => {
  auth.mockResolvedValue({ roles: ["maintenance"] });
});

describe("Vendors (#178)", () => {
  it("lists each vendor with legacy's fields, and Edit for the shop", async () => {
    listVendors.mockResolvedValue([vendor()]);
    render(await VendorsPage());
    const row = screen.getByRole("row", { name: /Northern Prop/ });
    expect(within(row).getByText("Prop Shop")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "907-555-0100" })).toHaveAttribute("href", "tel:907-555-0100");
    expect(within(row).getByRole("link", { name: "sam@northernprop.test" })).toHaveAttribute("href", "mailto:sam@northernprop.test");
    expect(within(row).getByText("N2PR123K")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: /Edit Northern Prop/ })).toHaveAttribute("href", "/maintenance/vendors/v-1/edit");
    expect(screen.getByText("1 vendor")).toBeInTheDocument();
  });

  it("reads only, for staff outside the shop", async () => {
    auth.mockResolvedValue({ roles: ["dispatcher"] });
    listVendors.mockResolvedValue([vendor()]);
    render(await VendorsPage());
    expect(screen.queryByRole("link", { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "+ Add Vendor" })).not.toBeInTheDocument();
  });

  it("starts an empty list", async () => {
    listVendors.mockResolvedValue([]);
    render(await VendorsPage());
    expect(screen.getByRole("link", { name: "Add First Vendor" })).toHaveAttribute("href", "/maintenance/vendors/new");
  });

  it("says so when it can't load", async () => {
    listVendors.mockRejectedValue(new TestApiError(500, "/mx-vendors", "boom"));
    render(await VendorsPage());
    expect(screen.getByRole("alert")).toHaveTextContent("unavailable");
  });
});
