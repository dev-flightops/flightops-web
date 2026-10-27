import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPortalInvoicePdfBase64, ApiError, SessionExpiredError } = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  class SessionExpiredError extends Error {}
  return { getPortalInvoicePdfBase64: vi.fn(), ApiError, SessionExpiredError };
});
vi.mock("@/lib/api/client", () => ({ ApiError, SessionExpiredError }));
vi.mock("@/lib/api/portal", () => ({ getPortalInvoicePdfBase64 }));

import { portalInvoicePdfAction } from "./actions";

beforeEach(() => {
  getPortalInvoicePdfBase64.mockReset();
});

describe("portalInvoicePdfAction (#129)", () => {
  it("hands back the PDF named for the invoice", async () => {
    getPortalInvoicePdfBase64.mockResolvedValue("JVBERi0=");
    expect(await portalInvoicePdfAction("i-2", "INV-000002")).toEqual({
      status: "ok",
      base64: "JVBERi0=",
      filename: "INV-000002.pdf",
    });
    expect(getPortalInvoicePdfBase64).toHaveBeenCalledWith("i-2");
  });

  it("says an invoice that is no longer theirs to see isn't available", async () => {
    getPortalInvoicePdfBase64.mockRejectedValue(new ApiError(404, "/billing/portal/invoices/i-9/pdf", "invoice_not_found"));
    expect(await portalInvoicePdfAction("i-9", "INV-000009")).toEqual({
      status: "error",
      message: "This invoice is no longer available. Refresh the page.",
    });
  });

  it("asks them to sign in again when the session has expired", async () => {
    getPortalInvoicePdfBase64.mockRejectedValue(new SessionExpiredError("expired"));
    expect((await portalInvoicePdfAction("i-2", "INV-000002")).status).toBe("error");
    expect(await portalInvoicePdfAction("i-2", "INV-000002")).toMatchObject({
      message: "Your session has expired. Sign in again.",
    });
  });
});
