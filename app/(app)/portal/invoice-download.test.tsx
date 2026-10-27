import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { portalInvoicePdfAction } = vi.hoisted(() => ({ portalInvoicePdfAction: vi.fn() }));
vi.mock("./actions", () => ({ portalInvoicePdfAction }));

import { InvoiceDownload } from "./invoice-download";

beforeEach(() => {
  portalInvoicePdfAction.mockReset();
});

describe("the customer's invoice PDF (#129)", () => {
  it("saves the invoice's own PDF under its number", async () => {
    portalInvoicePdfAction.mockResolvedValue({ status: "ok", base64: btoa("%PDF-1.4"), filename: "INV-000002.pdf" });
    const created = vi.fn(() => "blob:invoice");
    const revoked = vi.fn();
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
    const saved: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });

    render(<InvoiceDownload invoiceId="i-2" invoiceNumber="INV-000002" />);
    await userEvent.click(screen.getByRole("button", { name: "Download INV-000002 as a PDF" }));

    await waitFor(() => expect(saved).toEqual(["INV-000002.pdf"]));
    expect(portalInvoicePdfAction).toHaveBeenCalledWith("i-2", "INV-000002");
    expect(revoked).toHaveBeenCalledWith("blob:invoice");
    click.mockRestore();
  });

  it("says why when there is no PDF to give", async () => {
    portalInvoicePdfAction.mockResolvedValue({
      status: "error",
      message: "This invoice is no longer available. Refresh the page.",
    });
    render(<InvoiceDownload invoiceId="i-9" invoiceNumber="INV-000009" />);
    await userEvent.click(screen.getByRole("button", { name: "Download INV-000009 as a PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This invoice is no longer available. Refresh the page.");
  });
});
