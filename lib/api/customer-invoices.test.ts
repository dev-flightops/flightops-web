import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The wire contract with billing-service: the paths and bodies the
 * money calls send. The action tests mock this module away, so a body
 * missing `method` (which billing refuses with a 422) or a mistyped
 * path would otherwise pass every test.
 */

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("./client", () => ({ apiFetch }));

import {
  markCustomerInvoicePaid,
  recordCustomerInvoicePayment,
  voidCustomerInvoicePayment,
} from "./customer-invoices";

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({});
});

function sent(): [string, { method: string; body: unknown }] {
  const [path, init] = apiFetch.mock.calls[0];
  return [path, { method: init.method, body: JSON.parse(init.body) }];
}

describe("markCustomerInvoicePaid", () => {
  it("posts the method, the date and the reference to /paid", async () => {
    await markCustomerInvoicePaid("inv-1", "check", "2026-10-01", "1042");
    expect(sent()).toEqual([
      "/billing/customer-invoices/inv-1/paid",
      {
        method: "POST",
        body: { method: "check", paid_on: "2026-10-01", reference: "1042" },
      },
    ]);
  });

  it("sends null for a date or reference not given", async () => {
    await markCustomerInvoicePaid("inv-1", "transfer");
    expect(sent()[1].body).toEqual({
      method: "transfer",
      paid_on: null,
      reference: null,
    });
  });
});

describe("recordCustomerInvoicePayment", () => {
  it("posts the payment to /payments as given", async () => {
    await recordCustomerInvoicePayment("inv-1", {
      amount_cents: 25_000,
      method: "card",
      received_on: "2026-10-02",
      reference: null,
    });
    expect(sent()).toEqual([
      "/billing/customer-invoices/inv-1/payments",
      {
        method: "POST",
        body: {
          amount_cents: 25_000,
          method: "card",
          received_on: "2026-10-02",
          reference: null,
        },
      },
    ]);
  });
});

describe("voidCustomerInvoicePayment", () => {
  it("posts the reason to the payment's void", async () => {
    await voidCustomerInvoicePayment("inv-1", "pay-7", "Check returned unpaid");
    expect(sent()).toEqual([
      "/billing/customer-invoices/inv-1/payments/pay-7/void",
      { method: "POST", body: { reason: "Check returned unpaid" } },
    ]);
  });
});
