import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPortalDashboard, getPortalInvoices, listSupplierFuelOrders, redirectMock } = vi.hoisted(
  () => ({
    getPortalDashboard: vi.fn(),
    getPortalInvoices: vi.fn(),
    listSupplierFuelOrders: vi.fn(),
    redirectMock: vi.fn((to: string) => {
      throw new Error(`NEXT_REDIRECT:${to}`);
    }),
  }),
);

vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/api/portal", () => ({
  getPortalDashboard,
  getPortalInvoices,
  formatQuote: (cents: number) => `$${(cents / 100).toFixed(2)}`,
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
  getPortalInvoices.mockReset().mockResolvedValue({ linked: false, items: [], balance_cents: 0 });
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

describe("/portal invoices (#129)", () => {
  const linked = {
    profile: { linked: true, customer_id: "c-1", display_name: "Kalskag Store" },
    items: [],
    total: 0,
  };
  const invoice = (over: Record<string, unknown>) => ({
    id: "i-1",
    invoice_number: "INV-000002",
    invoice_date: "2026-10-22",
    due_date: "2026-11-21",
    flight_number: "PGR701",
    flight_date: "2026-10-22",
    origin_icao: "PANC",
    destination_icao: "PABE",
    total_cents: 50000,
    paid_cents: 0,
    balance_cents: 50000,
    status: "sent",
    ...over,
  });

  function row(number: string): HTMLElement {
    return screen.getByText(number).closest("tr") as HTMLElement;
  }

  it("lists the invoices sent to them, with what is owed and each PDF", async () => {
    getPortalDashboard.mockResolvedValue(linked);
    getPortalInvoices.mockResolvedValue({
      linked: true,
      balance_cents: 30000,
      items: [
        invoice({ id: "i-4", invoice_number: "INV-000004", status: "void", total_cents: 7500, balance_cents: 0 }),
        invoice({ id: "i-3", invoice_number: "INV-000003", status: "paid", total_cents: 25000, paid_cents: 25000, balance_cents: 0 }),
        invoice({ id: "i-2", invoice_number: "INV-000002", paid_cents: 20000, balance_cents: 30000 }),
      ],
    });
    render(await PortalPage());
    expect(screen.getByRole("heading", { name: "Invoices" })).toBeInTheDocument();
    expect(screen.getByText("Balance due $300.00")).toBeInTheDocument();

    const open = row("INV-000002");
    expect(open.textContent).toContain("Part paid");
    expect(open.textContent).toContain("$500.00");
    expect(open.textContent).toContain("$300.00");
    expect(open.textContent).toContain("Due Nov 21, 2026");
    expect(open.textContent).toContain("PANC → PABE");
    expect(row("INV-000003").textContent).toContain("Paid");
    expect(row("INV-000003").textContent).not.toContain("Due ");
    expect(row("INV-000004").textContent).toContain("Void");
    for (const n of ["INV-000002", "INV-000003", "INV-000004"]) {
      expect(screen.getByRole("button", { name: `Download ${n} as a PDF` })).toBeInTheDocument();
    }
  });

  it("says when there are none yet, with no balance", async () => {
    getPortalDashboard.mockResolvedValue(linked);
    getPortalInvoices.mockResolvedValue({ linked: true, items: [], balance_cents: 0 });
    render(await PortalPage());
    expect(screen.getByText("No invoices yet.")).toBeInTheDocument();
    expect(screen.queryByText(/Balance due/)).toBeNull();
  });

  it("keeps the charters when the invoices can't be read", async () => {
    getPortalDashboard.mockResolvedValue(linked);
    getPortalInvoices.mockRejectedValue(new Error("502"));
    render(await PortalPage());
    expect(screen.getByText(/no charter flights on file yet/i)).toBeInTheDocument();
    expect(screen.getByText(/couldn.t load your invoices just now/)).toBeInTheDocument();
  });

  it("shows no invoices to a login with no customer profile", async () => {
    getPortalDashboard.mockResolvedValue(unlinked);
    listSupplierFuelOrders.mockRejectedValue(new Error("403"));
    render(await PortalPage());
    expect(screen.queryByRole("heading", { name: "Invoices" })).toBeNull();
  });
});
