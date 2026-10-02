import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

const { markPaidAction, voidInvoiceAction } = vi.hoisted(() => ({
  markPaidAction: vi.fn(),
  voidInvoiceAction: vi.fn(),
}));
vi.mock("../actions", () => ({
  invoicePdfAction: vi.fn(),
  markPaidAction,
  sendInvoiceAction: vi.fn(),
  voidInvoiceAction,
}));
vi.mock("../payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../payments")>()),
  todayLocalIsoDate: () => "2026-10-02",
}));

import { InvoiceActions } from "./invoice-actions";

function renderActions(
  props: Partial<React.ComponentProps<typeof InvoiceActions>> = {},
) {
  return render(
    <InvoiceActions
      invoiceId="inv-1"
      invoiceNumber="INV-000007"
      status="sent"
      hasUnpricedLines={false}
      paidCents={0}
      outstandingCents={100_000}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  markPaidAction.mockResolvedValue({ status: "ok", message: "Marked paid." });
});

describe("Void", () => {
  it("is offered on a sent invoice nothing has been paid against", () => {
    renderActions();
    expect(screen.getByRole("button", { name: "Void" })).toBeInTheDocument();
  });

  it("is not offered once any money has been received", () => {
    // The service refuses it: voiding would strand the payments.
    renderActions({ paidCents: 25_000, outstandingCents: 75_000 });
    expect(screen.queryByRole("button", { name: "Void" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark paid" })).toBeInTheDocument();
  });

  it("is not offered on a paid invoice", () => {
    renderActions({ status: "paid", paidCents: 100_000, outstandingCents: 0 });
    expect(screen.queryByRole("button", { name: "Void" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark paid" })).not.toBeInTheDocument();
  });
});

describe("Mark paid", () => {
  it("asks how and when the money arrived, and says what it records", async () => {
    const user = userEvent.setup();
    const { container } = renderActions({ paidCents: 40_000, outstandingCents: 60_000 });
    await user.click(screen.getByRole("button", { name: "Mark paid" }));

    expect(
      screen.getByText(/Records the outstanding/).textContent,
    ).toBe("Records the outstanding 600.00 as one payment and closes the invoice.");
    expect(screen.getByLabelText("Received")).toHaveValue("2026-10-02");
    expect(screen.getByLabelText("Received")).toHaveAttribute("max", "2026-10-02");
    await expectNoA11yViolations(container);
  });

  it("needs a method before it can be confirmed", async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole("button", { name: "Mark paid" }));
    const confirm = screen.getByRole("button", { name: "Confirm paid" });
    expect(confirm).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Method"), "check");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() =>
      expect(markPaidAction).toHaveBeenCalledWith("inv-1", "check", "2026-10-02"),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Marked paid.");
  });

  it("offers the five form methods and not comp or on-account", async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole("button", { name: "Mark paid" }));
    const options = Array.from(
      (screen.getByLabelText("Method") as HTMLSelectElement).options,
    ).map((o) => o.textContent);
    expect(options).toEqual(["Choose…", "Cash", "Check", "Card", "ACH or wire", "Other"]);
  });
});

describe("an open void panel", () => {
  it("goes away when a payment arrives while it is open", async () => {
    const user = userEvent.setup();
    const { rerender } = renderActions();
    await user.click(screen.getByRole("button", { name: "Void" }));
    expect(screen.getByRole("button", { name: "Confirm void" })).toBeInTheDocument();

    // The page re-renders with the payment recorded below the header.
    rerender(
      <InvoiceActions
        invoiceId="inv-1"
        invoiceNumber="INV-000007"
        status="sent"
        hasUnpricedLines={false}
        paidCents={25_000}
        outstandingCents={75_000}
      />,
    );
    expect(screen.queryByRole("button", { name: "Confirm void" })).not.toBeInTheDocument();
    expect(voidInvoiceAction).not.toHaveBeenCalled();
  });
});
