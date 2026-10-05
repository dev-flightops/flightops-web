import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  markCustomerInvoicePaid,
  recordCustomerInvoicePayment,
  voidCustomerInvoice,
  voidCustomerInvoicePayment,
  revalidatePath,
  TestApiError,
  TestSessionExpiredError,
} = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  }
  // The real class's shape: (path, message), always a 401.
  class TestSessionExpiredError extends TestApiError {
    constructor(path: string, message: string) {
      super(401, path, message);
      this.name = "SessionExpiredError";
    }
  }
  return {
    markCustomerInvoicePaid: vi.fn(),
    recordCustomerInvoicePayment: vi.fn(),
    voidCustomerInvoice: vi.fn(),
    voidCustomerInvoicePayment: vi.fn(),
    revalidatePath: vi.fn(),
    TestApiError,
    TestSessionExpiredError,
  };
});

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api/client", () => ({
  ApiError: TestApiError,
  SessionExpiredError: TestSessionExpiredError,
}));
vi.mock("@/lib/api/customer-invoices", () => ({
  getCustomerInvoicePdfBase64: vi.fn(),
  markCustomerInvoicePaid,
  recordCustomerInvoicePayment,
  sendCustomerInvoice: vi.fn(),
  voidCustomerInvoice,
  voidCustomerInvoicePayment,
}));

import {
  markPaidAction,
  recordPaymentAction,
  voidInvoiceAction,
  voidPaymentAction,
} from "./actions";

const refused = (detail: string, status = 409) =>
  new TestApiError(status, "/billing/customer-invoices/inv-1", JSON.stringify({ detail }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordPaymentAction", () => {
  const form = {
    amount: "250.00",
    method: "cash",
    receivedOn: "2026-10-02",
    reference: "  receipt 0042 ",
  };

  it("sends cents, the method, the date and the trimmed reference", async () => {
    recordCustomerInvoicePayment.mockResolvedValueOnce({
      settled: false,
      outstanding_cents: 75_000,
    });
    const state = await recordPaymentAction("inv-1", form);
    expect(recordCustomerInvoicePayment).toHaveBeenCalledWith("inv-1", {
      amount_cents: 25_000,
      method: "cash",
      received_on: "2026-10-02",
      reference: "receipt 0042",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/invoicing/inv-1");
    expect(state).toEqual({
      status: "ok",
      message: "Recorded 250.00 (Cash). 750.00 still outstanding.",
    });
  });

  it("says when the payment settled the invoice", async () => {
    recordCustomerInvoicePayment.mockResolvedValueOnce({
      settled: true,
      outstanding_cents: 0,
    });
    const state = await recordPaymentAction("inv-1", {
      ...form,
      method: "transfer",
      reference: "",
    });
    expect(recordCustomerInvoicePayment.mock.calls[0][1].reference).toBeNull();
    expect(state).toEqual({
      status: "ok",
      message: "Recorded 250.00 (ACH or wire). The invoice is paid.",
    });
  });

  it("refuses a bad amount, an unoffered method or no date without calling the service", async () => {
    for (const bad of [
      { ...form, amount: "0" },
      { ...form, amount: "ten" },
      { ...form, method: "comp" },
      { ...form, method: "" },
      { ...form, receivedOn: "" },
    ]) {
      const state = await recordPaymentAction("inv-1", bad);
      expect(state.status).toBe("error");
    }
    expect(recordCustomerInvoicePayment).not.toHaveBeenCalled();
  });

  it("explains an overpayment with what is still outstanding", async () => {
    recordCustomerInvoicePayment.mockRejectedValueOnce(
      refused("payment_exceeds_outstanding_of_40000"),
    );
    const state = await recordPaymentAction("inv-1", form);
    expect(state).toEqual({
      status: "error",
      message: "That is more than the 400.00 still outstanding.",
    });
  });

  it("explains a future date", async () => {
    recordCustomerInvoicePayment.mockRejectedValueOnce(
      refused("received_on_in_the_future", 400),
    );
    const state = await recordPaymentAction("inv-1", form);
    expect(state).toEqual({
      status: "error",
      message: "A payment cannot be dated in the future.",
    });
  });

  it.each([
    [
      "an expired session",
      new TestSessionExpiredError("/billing/customer-invoices/inv-1/payments", "expired"),
      "Your session has expired. Sign in again.",
    ],
    [
      "billing unreachable",
      new Error("fetch failed"),
      "Could not reach billing-service.",
    ],
    [
      "an invoice voided meanwhile",
      refused("invoice_is_void"),
      "This invoice is void and cannot take a payment.",
    ],
    [
      "a draft",
      refused("invoice_not_sent_yet"),
      "Send the invoice before recording a payment on it.",
    ],
    [
      "any other refusal",
      refused("x", 403),
      "Could not record the payment (HTTP 403).",
    ],
  ])("explains %s", async (_case, err, message) => {
    recordCustomerInvoicePayment.mockRejectedValueOnce(err);
    const state = await recordPaymentAction("inv-1", form);
    expect(state).toEqual({ status: "error", message });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("markPaidAction", () => {
  it("sends the method, the date and the trimmed reference", async () => {
    markCustomerInvoicePaid.mockResolvedValueOnce({});
    const state = await markPaidAction("inv-1", "check", "2026-10-01", " 1042 ");
    expect(markCustomerInvoicePaid).toHaveBeenCalledWith(
      "inv-1",
      "check",
      "2026-10-01",
      "1042",
    );
    expect(state).toEqual({ status: "ok", message: "Marked paid." });
  });

  it("sends no reference when none was typed", async () => {
    markCustomerInvoicePaid.mockResolvedValueOnce({});
    await markPaidAction("inv-1", "cash", "2026-10-01", "   ");
    expect(markCustomerInvoicePaid.mock.calls[0][3]).toBeNull();
  });

  it("will not mark paid without a method", async () => {
    const state = await markPaidAction("inv-1", "", "2026-10-01", "");
    expect(state.status).toBe("error");
    expect(markCustomerInvoicePaid).not.toHaveBeenCalled();
  });
});

describe("voidPaymentAction", () => {
  it("sends the trimmed reason and says what was voided", async () => {
    voidCustomerInvoicePayment.mockResolvedValueOnce({
      payment: { amount_cents: 60_000, method: "check" },
      outstanding_cents: 60_000,
    });
    const state = await voidPaymentAction(
      "inv-1",
      "pay-7",
      "  Check returned unpaid ",
    );
    expect(voidCustomerInvoicePayment).toHaveBeenCalledWith(
      "inv-1",
      "pay-7",
      "Check returned unpaid",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/invoicing/inv-1");
    expect(state).toEqual({
      status: "ok",
      message: "Voided the 600.00 (Check) payment. 600.00 outstanding.",
    });
  });

  it("will not void without a reason", async () => {
    for (const reason of ["", "   ", "no"]) {
      const state = await voidPaymentAction("inv-1", "pay-7", reason);
      expect(state).toEqual({
        status: "error",
        message: "Say why the payment is being voided.",
      });
    }
    expect(voidCustomerInvoicePayment).not.toHaveBeenCalled();
  });

  it.each([
    ["already voided", refused("payment_already_voided"), "That payment has already been voided."],
    ["not on this invoice", refused("payment_not_found", 404), "That payment is not on this invoice."],
  ])("explains a payment %s", async (_case, err, message) => {
    voidCustomerInvoicePayment.mockRejectedValueOnce(err);
    const state = await voidPaymentAction("inv-1", "pay-7", "wrong invoice");
    expect(state).toEqual({ status: "error", message });
  });
});

describe("voidInvoiceAction", () => {
  it("explains why an invoice with payments cannot be voided", async () => {
    voidCustomerInvoice.mockRejectedValueOnce(refused("invoice_has_payments"));
    const state = await voidInvoiceAction("inv-1", "raised in error");
    expect(state).toEqual({
      status: "error",
      message:
        "This invoice has payments recorded against it, so it cannot be voided.",
    });
  });
});
