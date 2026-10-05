import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCustomer, listBookings, listCustomerInvoices } = vi.hoisted(() => ({
  getCustomer: vi.fn(),
  listBookings: vi.fn(),
  listCustomerInvoices: vi.fn(),
}));

vi.mock("@/lib/api/reservations", () => ({
  getCustomer,
  listBookings,
  CUSTOMER_TYPE_LABELS: {
    individual: "Individual",
    corporate: "Corporate",
    government: "Government",
    non_profit: "Non-profit",
  },
  BOOKING_STATUS_LABELS: {
    requested: "Requested",
    quoted: "Quoted",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
  },
}));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/api/customer-invoices", () => ({ listCustomerInvoices }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));

import CustomerDetailPage from "./page";

const ID = "22222222-2222-4222-8222-222222222222";

async function renderPage() {
  render(
    await CustomerDetailPage({
      params: Promise.resolve({ id: ID }),
      searchParams: Promise.resolve({}),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getCustomer.mockResolvedValue({
    id: ID,
    full_name: "Ann Acme",
    company_name: "Acme Mining",
    email: null,
    phone: null,
    customer_type: "corporate",
    notes: null,
    archived_at: null,
  });
  listBookings.mockResolvedValue({ items: [], total: 0 });
});

describe("a customer's invoices and balance (#30)", () => {
  it("lists the customer's invoices with the balance owed", async () => {
    listCustomerInvoices.mockResolvedValue({
      items: [
        { id: "i-1", invoice_number: "INV-000001", status: "sent", total_cents: 100000 },
        { id: "i-2", invoice_number: "INV-000002", status: "draft", total_cents: 30000 },
      ],
      total: 2,
      outstanding_cents: 60000,
    });
    await renderPage();

    expect(listCustomerInvoices).toHaveBeenCalledWith({ customer_id: ID, limit: 50 });
    const section = screen.getByRole("region", { name: "Invoices" });
    expect(within(section).getByText("Balance owed")).toBeInTheDocument();
    expect(within(section).getByText(/600\.00/)).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: /INV-000001/ }).getAttribute("href")).toBe("/invoicing/i-1");
    expect(within(section).getByRole("link", { name: /Open in Invoicing/ }).getAttribute("href")).toBe(
      `/invoicing?customer=${ID}`,
    );
  });

  it("leaves the section out for a role billing refuses", async () => {
    listCustomerInvoices.mockRejectedValue(new Error("403"));
    await renderPage();
    expect(screen.queryByRole("region", { name: "Invoices" })).toBeNull();
    expect(screen.getByText("Booking history")).toBeInTheDocument();
  });
});
