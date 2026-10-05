import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, sendCustomerInvoice, revalidatePath } = vi.hoisted(() => {
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
    sendCustomerInvoice: vi.fn(),
    revalidatePath: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({
  ApiError: TestApiError,
  SessionExpiredError: class extends TestApiError {},
}));
vi.mock("@/lib/api/customer-invoices", () => ({
  getCustomerInvoicePdfBase64: vi.fn(),
  markCustomerInvoicePaid: vi.fn(),
  recordCustomerInvoicePayment: vi.fn(),
  sendCustomerInvoice,
  voidCustomerInvoice: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { sendInvoiceAction } from "./actions";

/**
 * Marking an invoice sent records it as sent; nothing is emailed yet
 * (#25, item 8), so what the action says must not claim otherwise.
 */

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendInvoiceAction", () => {
  it("says the invoice was marked as sent, not that it was sent", async () => {
    sendCustomerInvoice.mockResolvedValue({});
    expect(await sendInvoiceAction("inv-1")).toEqual({
      status: "ok",
      message: "Marked as sent.",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/invoicing/inv-1");
  });

  it("says how to price a line before it can be marked as sent", async () => {
    sendCustomerInvoice.mockRejectedValue(
      new TestApiError(409, "/x", '{"detail":"invoice_has_unpriced_lines"}'),
    );
    expect(await sendInvoiceAction("inv-1")).toEqual({
      status: "error",
      message:
        "This invoice has a line with no price yet. Set the cargo rate in Settings → Company, then void this draft and raise the flight's invoices again.",
    });
  });

  it("names the action in its fallback", async () => {
    sendCustomerInvoice.mockRejectedValue(new TestApiError(500, "/x", "boom"));
    expect(await sendInvoiceAction("inv-1")).toEqual({
      status: "error",
      message: "Could not mark it as sent (HTTP 500).",
    });
  });
});
