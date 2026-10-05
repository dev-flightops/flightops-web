import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendInvoiceAction } = vi.hoisted(() => ({
  sendInvoiceAction: vi.fn(),
}));
vi.mock("../actions", () => ({
  invoicePdfAction: vi.fn(),
  markPaidAction: vi.fn(),
  sendInvoiceAction,
  voidInvoiceAction: vi.fn(),
}));

import { InvoiceActions } from "./invoice-actions";

/**
 * "Send" emailed nothing: it only recorded the invoice as sent. Until
 * invoices are emailed (#25, item 8) the button says what it does, and
 * nothing on the page says the invoice went anywhere.
 */

type Props = React.ComponentProps<typeof InvoiceActions>;

function renderDraft(over: Partial<Props> = {}) {
  // Cast so this keeps compiling as the component gains props (the
  // payments work adds two); the ones below are all these tests need.
  const props = {
    invoiceId: "inv-1",
    invoiceNumber: "INV-000001",
    status: "draft",
    hasUnpricedLines: false,
    ...over,
  } as Props;
  return render(<InvoiceActions {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  sendInvoiceAction.mockResolvedValue({ status: "ok", message: "Marked as sent." });
});

describe("Mark as sent", () => {
  it("is what the button on a draft says", () => {
    renderDraft();
    expect(screen.getByRole("button", { name: "Mark as sent" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("records the invoice as sent and says only that", async () => {
    const user = userEvent.setup();
    renderDraft();
    await user.click(screen.getByRole("button", { name: "Mark as sent" }));
    expect(sendInvoiceAction).toHaveBeenCalledWith("inv-1");
    expect(await screen.findByRole("status")).toHaveTextContent("Marked as sent.");
    expect(document.body.textContent).not.toMatch(/email/i);
  });

  it("is not offered on an invoice with an unpriced line, which says how to price it", () => {
    renderDraft({ hasUnpricedLines: true });
    expect(screen.queryByRole("button", { name: "Mark as sent" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "This invoice has a line with no price, so it can't be marked as sent. Set the cargo rate in Settings → Company, then void this draft and raise the flight's invoices again.",
      ),
    ).toBeInTheDocument();
  });

  it("is not offered once the invoice is sent", () => {
    renderDraft({ status: "sent" });
    expect(screen.queryByRole("button", { name: "Mark as sent" })).not.toBeInTheDocument();
  });
});
