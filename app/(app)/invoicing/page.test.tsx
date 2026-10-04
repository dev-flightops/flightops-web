import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, listCustomerInvoices } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, listCustomerInvoices: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/customer-invoices", () => ({ listCustomerInvoices }));
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
