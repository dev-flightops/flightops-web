import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, listCustomerInvoices, listCustomers } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, listCustomerInvoices: vi.fn(), listCustomers: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/customer-invoices", () => ({ listCustomerInvoices }));
vi.mock("@/lib/api/reservations", () => ({ listCustomers }));
vi.mock("./raise-actions", () => ({
  raiseInvoicesAction: vi.fn(),
  flownFlightsOnAction: vi.fn(),
}));

import InvoicingPage from "./page";

/**
 * /invoicing raises invoices itself now. The empty state used to send
 * people to the dispatch board, which has never raised an invoice.
 */

async function renderPage(status?: string) {
  const ui = await InvoicingPage({ searchParams: Promise.resolve({ status }) });
  render(ui);
}

beforeEach(() => {
  vi.clearAllMocks();
  listCustomers.mockResolvedValue({ items: [], total: 0 });
});

describe("/invoicing", () => {
  it("offers Raise invoices, and the empty state points at it", async () => {
    listCustomerInvoices.mockResolvedValue({
      items: [],
      total: 0,
      outstanding_cents: 0,
    });
    await renderPage();
    expect(screen.getByRole("button", { name: "Raise invoices" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "No invoices yet. Raise a flown flight's invoices with Raise invoices above.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/dispatch board/)).not.toBeInTheDocument();
  });

  it("does not offer it to a role the service refuses", async () => {
    listCustomerInvoices.mockRejectedValue(
      new TestApiError(403, "/billing/customer-invoices", "insufficient_role"),
    );
    await renderPage();
    expect(
      screen.getByText(
        "Invoicing is limited to executive admins and the director of operations.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raise invoices" })).not.toBeInTheDocument();
  });
});

describe("/invoicing filtered by customer (#30)", () => {
  const ACME = "22222222-2222-4222-8222-222222222222";

  it("sends the customer to the service, names them in the caption, and keeps them on the status chips", async () => {
    listCustomers.mockResolvedValue({
      items: [{ id: ACME, full_name: "Ann Acme", company_name: "Acme Mining", customer_type: "corporate" }],
      total: 1,
    });
    listCustomerInvoices.mockResolvedValue({ items: [], total: 0, outstanding_cents: 60000 });
    render(await InvoicingPage({ searchParams: Promise.resolve({ customer: ACME }) }));

    expect(listCustomerInvoices).toHaveBeenCalledWith({ status: undefined, customer_id: ACME, limit: 100 });
    expect(screen.getByText(/sent, less payments ·\s*Acme Mining/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Paid" }).getAttribute("href")).toBe(
      `/invoicing?status=paid&customer=${ACME}`,
    );
    expect((screen.getByLabelText("Customer") as HTMLSelectElement).value).toBe(ACME);
  });

  it("leaves the customer filter out when customers can't be read", async () => {
    listCustomers.mockRejectedValue(new TestApiError(403, "/reservations/customers", "no"));
    listCustomerInvoices.mockResolvedValue({ items: [], total: 0, outstanding_cents: 0 });
    await renderPage();
    expect(screen.queryByLabelText("Customer")).toBeNull();
    expect(screen.getByText(/all invoices/)).toBeInTheDocument();
  });
});
