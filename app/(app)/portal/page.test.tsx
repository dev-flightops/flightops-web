import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPortalDashboard, listSupplierFuelOrders, redirectMock } = vi.hoisted(
  () => ({
    getPortalDashboard: vi.fn(),
    listSupplierFuelOrders: vi.fn(),
    redirectMock: vi.fn((to: string) => {
      throw new Error(`NEXT_REDIRECT:${to}`);
    }),
  }),
);

vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/api/portal", () => ({
  getPortalDashboard,
  formatQuote: (v: unknown) => String(v),
}));
vi.mock("@/lib/api/ground", () => ({ listSupplierFuelOrders }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import PortalPage from "./page";

const unlinked = {
  profile: { linked: false, customer_id: null, display_name: null },
  items: [],
  total: 0,
};

beforeEach(() => {
  getPortalDashboard.mockReset();
  listSupplierFuelOrders.mockReset();
  redirectMock.mockClear();
});

describe("/portal for a login with no customer profile", () => {
  it("sends a fuel supplier's rep to the supplier inbox", async () => {
    // Every login without a staff role lands on the portal; a supplier
    // rep is one of them, and the inbox answers them.
    getPortalDashboard.mockResolvedValue(unlinked);
    listSupplierFuelOrders.mockResolvedValue({ items: [], total: 0 });
    await expect(PortalPage()).rejects.toThrow("NEXT_REDIRECT:/fuel/supplier");
  });

  it("tells anyone else to contact operations", async () => {
    getPortalDashboard.mockResolvedValue(unlinked);
    listSupplierFuelOrders.mockRejectedValue(new Error("403"));
    render(await PortalPage());
    expect(
      screen.getByText(/isn.t linked to a customer profile yet/i),
    ).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("/portal for a linked customer", () => {
  it("lists their charters and never asks about suppliers", async () => {
    getPortalDashboard.mockResolvedValue({
      profile: { linked: true, customer_id: "c-1", display_name: "Ella Ramirez" },
      items: [],
      total: 0,
    });
    render(await PortalPage());
    expect(screen.getByText(/no charter flights on file yet/i)).toBeInTheDocument();
    expect(listSupplierFuelOrders).not.toHaveBeenCalled();
  });
});
