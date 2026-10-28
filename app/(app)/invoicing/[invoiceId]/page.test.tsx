import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CustomerInvoiceDetail,
  CustomerPayment,
} from "@/lib/api/customer-invoices";

/**
 * /invoicing/[invoiceId]: the wiring between the invoice's money and
 * what the page offers. Mis-wiring two numbers here type-checks: passing
 * the outstanding balance as paidCents would hide Void on every unpaid
 * invoice. So the gates are pinned against the figures the service
 * sends.
 */

const { TestApiError, getCustomerInvoice, notFound, listStaff } = vi.hoisted(() => {
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
    getCustomerInvoice: vi.fn(),
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
    listStaff: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/api/customer-invoices", () => ({ getCustomerInvoice }));
vi.mock("@/lib/api/auth", () => ({ listStaff }));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { email: "me@test.local" } })) }));
vi.mock("../actions", () => ({
  invoicePdfAction: vi.fn(),
  markPaidAction: vi.fn(),
  recordPaymentAction: vi.fn(),
  sendInvoiceAction: vi.fn(),
  voidInvoiceAction: vi.fn(),
  voidPaymentAction: vi.fn(),
}));

import InvoiceDetailPage from "./page";

function payment(over: Partial<CustomerPayment> & { id: string }): CustomerPayment {
  return {
    amount_cents: 40_000,
    method: "transfer",
    received_on: "2026-09-30",
    reference: null,
    notes: null,
    voided_at: null,
    voided_by: null,
    void_reason: null,
    ...over,
  };
}

function invoice(over: Partial<CustomerInvoiceDetail> = {}): CustomerInvoiceDetail {
  return {
    id: "inv-1",
    invoice_number: "INV-000007",
    customer: { id: "c-1", full_name: "Kalskag Store" },
    flight_id: null,
    flight_number: "PGR700",
    aircraft_tail: "N900PA",
    flight_date: "2026-09-08",
    origin_icao: "PANC",
    destination_icao: "PABE",
    invoice_date: "2026-09-10",
    due_date: "2026-10-10",
    subtotal_cents: 100_000,
    tax_rate: null,
    tax_cents: 0,
    total_cents: 100_000,
    status: "sent",
    sent_at: "2026-09-10T12:00:00Z",
    paid_on: null,
    has_unpriced_lines: false,
    lines: [],
    void_reason: null,
    notes: null,
    paid_cents: 0,
    outstanding_cents: 100_000,
    payments: [],
    refunds: [],
    refunded_cents: 0,
    credit_notes: [],
    ...over,
  };
}

async function renderPage(detail: CustomerInvoiceDetail) {
  getCustomerInvoice.mockResolvedValueOnce(detail);
  const ui = await InvoiceDetailPage({
    params: Promise.resolve({ invoiceId: detail.id }),
  });
  return render(ui);
}

const invoiceVoid = () => screen.queryByRole("button", { name: "Void" });
const recordPayment = () =>
  screen.queryByRole("button", { name: "Record payment" });
const paymentsSection = () =>
  screen.queryByRole("region", { name: "Payments" });

beforeEach(() => {
  vi.clearAllMocks();
  listStaff.mockResolvedValue({
    items: [
      { id: "u-me", full_name: "Me Admin", email: "me@test.local", roles: ["exec_admin"] },
      { id: "u-do", full_name: "Dana Director", email: "dana@test.local", roles: ["director_of_operations"] },
      { id: "u-pilot", full_name: "Pat Pilot", email: "pat@test.local", roles: ["pilot"] },
    ],
    total: 3,
  });
});

describe("the invoice page's payments", () => {
  it("shows a draft's Void and no payments section", async () => {
    await renderPage(invoice({ status: "draft", sent_at: null }));
    expect(invoiceVoid()).toBeInTheDocument();
    expect(paymentsSection()).not.toBeInTheDocument();
  });

  it("offers Void, Mark paid and Record payment on a sent invoice with nothing paid", async () => {
    await renderPage(invoice());
    expect(invoiceVoid()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark paid" })).toBeInTheDocument();
    const section = paymentsSection();
    expect(section).toBeInTheDocument();
    expect(within(section!).getByText("No payments recorded.")).toBeInTheDocument();
    expect(recordPayment()).toBeInTheDocument();
  });

  it("withholds the invoice's Void once a payment counts, and lists it", async () => {
    await renderPage(
      invoice({
        paid_cents: 40_000,
        outstanding_cents: 60_000,
        payments: [payment({ id: "pay-1" })],
      }),
    );
    expect(invoiceVoid()).not.toBeInTheDocument();
    const section = paymentsSection()!;
    // Paid 400.00 and the row's 400.00; Outstanding 600.00.
    expect(within(section).getAllByText("400.00")).toHaveLength(2);
    expect(within(section).getByText("600.00")).toBeInTheDocument();
    expect(within(section).getByText("ACH or wire")).toBeInTheDocument();
    expect(
      within(section).getByRole("button", {
        name: "Void payment of 400.00 (ACH or wire)",
      }),
    ).toBeInTheDocument();
    expect(recordPayment()).toBeInTheDocument();
  });

  it("brings the invoice's Void back when its only payment was voided", async () => {
    await renderPage(
      invoice({
        paid_cents: 0,
        outstanding_cents: 100_000,
        payments: [
          payment({
            id: "pay-1",
            voided_at: "2026-10-02T16:40:00Z",
            voided_by: "u-1",
            void_reason: "Entered on the wrong invoice",
          }),
        ],
      }),
    );
    expect(invoiceVoid()).toBeInTheDocument();
    expect(screen.getByText(/Entered on the wrong invoice/)).toBeInTheDocument();
  });

  it("offers no Record payment on a paid invoice, but keeps its history", async () => {
    await renderPage(
      invoice({
        status: "paid",
        paid_on: "2026-09-30",
        paid_cents: 100_000,
        outstanding_cents: 0,
        payments: [payment({ id: "pay-1", amount_cents: 100_000, method: "check" })],
      }),
    );
    expect(recordPayment()).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark paid" })).not.toBeInTheDocument();
    expect(invoiceVoid()).not.toBeInTheDocument();
    expect(within(paymentsSection()!).getByText("Check")).toBeInTheDocument();
  });

  it("shows the payments still held by a void invoice", async () => {
    await renderPage(
      invoice({
        status: "void",
        void_reason: "Duplicate",
        paid_cents: 40_000,
        outstanding_cents: 0,
        payments: [payment({ id: "pay-1" })],
      }),
    );
    expect(paymentsSection()).toBeInTheDocument();
    expect(recordPayment()).not.toBeInTheDocument();
    expect(within(paymentsSection()!).getByText("ACH or wire")).toBeInTheDocument();
  });
});

describe("refunds and credit notes on the invoice page (#127)", () => {
  const refundsSection = () => screen.queryByRole("region", { name: "Refunds" });

  it("offers nothing to refund before money comes in", async () => {
    await renderPage(invoice());
    expect(refundsSection()).not.toBeInTheDocument();
    expect(listStaff).not.toHaveBeenCalled();
  });

  it("offers Refund once money has come in", async () => {
    await renderPage(
      invoice({
        status: "paid",
        paid_cents: 100_000,
        outstanding_cents: 0,
        payments: [payment({ id: "pay-1", amount_cents: 100_000 })],
      }),
    );
    expect(within(refundsSection()!).getByRole("button", { name: "Refund" })).toBeInTheDocument();
  });

  it("nothing more to give back once it all went back", async () => {
    await renderPage(
      invoice({
        status: "paid",
        paid_cents: 100_000,
        outstanding_cents: 0,
        refunded_cents: 100_000,
        payments: [payment({ id: "pay-1", amount_cents: 100_000 })],
        refunds: [
          {
            id: "ref-1",
            kind: "original_payment",
            amount_cents: 100_000,
            refunded_on: "2026-10-02",
            reason: "Flight cancelled",
            reference: null,
            payment_id: "pay-1",
            credit_number: null,
            credit_remaining_cents: null,
            approved_by_name: "Dana Director",
            voided_at: null,
            void_reason: null,
          },
        ],
      }),
    );
    const section = refundsSection()!;
    expect(within(section).queryByRole("button", { name: "Refund" })).not.toBeInTheDocument();
    expect(section).toHaveTextContent("To the ACH or wire payment of 2026-09-30");
    expect(section).toHaveTextContent("Approved by Dana Director");
    expect(paymentsSection()).toHaveTextContent("Refunded");
  });

  it("offers the customer's credit on an invoice that owes", async () => {
    await renderPage(
      invoice({
        credit_notes: [
          {
            id: "cn-1",
            credit_number: "CN-000001",
            invoice_number: "INV-000003",
            refunded_on: "2026-10-01",
            remaining_cents: 15_000,
          },
        ],
      }),
    );
    expect(paymentsSection()).toHaveTextContent("The customer has 150.00 of credit.");
    expect(screen.getByRole("button", { name: "Pay with credit" })).toBeInTheDocument();
  });
});
