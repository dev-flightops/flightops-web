import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CustomerPayment, CustomerRefund } from "@/lib/api/customer-invoices";

/**
 * The refund form (#127): back to the payment it came from or as a
 * credit note, over $500 an approver, and nothing more than came in.
 */

const { refundAction, voidRefundAction } = vi.hoisted(() => ({
  refundAction: vi.fn(),
  voidRefundAction: vi.fn(),
}));
vi.mock("../actions", () => ({ refundAction, voidRefundAction }));

import { Refunds } from "./refunds";

const CARD: CustomerPayment = {
  id: "pay-card",
  amount_cents: 80_000,
  method: "card",
  received_on: "2026-10-01",
  reference: null,
  notes: null,
  voided_at: null,
  voided_by: null,
  void_reason: null,
};

const NOTE: CustomerRefund = {
  id: "ref-cn",
  kind: "credit_note",
  amount_cents: 10_000,
  refunded_on: "2026-10-03",
  reason: "Seat downgraded",
  reference: null,
  payment_id: null,
  credit_number: "CN-000001",
  credit_remaining_cents: 4_000,
  approved_by_name: null,
  voided_at: null,
  void_reason: null,
};

function show(over: Partial<Parameters<typeof Refunds>[0]> = {}) {
  return render(
    <Refunds
      invoiceId="inv-1"
      invoiceNumber="INV-000001"
      refunds={[NOTE]}
      payments={[CARD]}
      refundableCents={70_000}
      hasCustomer
      canRefund
      approvers={[{ id: "u-do", name: "Dana Director" }]}
      {...over}
    />,
  );
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: "Refund" }));
  return screen.getByRole("form", { name: "Refund" });
}

beforeEach(() => {
  vi.clearAllMocks();
  refundAction.mockResolvedValue({ status: "ok", message: "Done." });
});

describe("Refunds (#127)", () => {
  it("lists a credit note with what it has left", () => {
    show();
    expect(screen.getByRole("region", { name: "Refunds" })).toHaveTextContent(
      "Credit note CN-000001 · 40.00 left",
    );
  });

  it("starts at what can go back, to the one payment", () => {
    show();
    const form = open();
    expect(within(form).getByLabelText("Amount")).toHaveValue("700.00");
    expect(within(form).getByLabelText("Payment")).toHaveValue("pay-card");
  });

  it("over $500 asks who approved it, from those who may", async () => {
    show();
    const form = open();
    expect(within(form).getByLabelText("Amount")).toHaveValue("700.00");
    const approver = within(form).getByLabelText("Approved by");
    expect(within(approver).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Choose…",
      "Dana Director",
    ]);
    fireEvent.change(within(form).getByLabelText("Why"), { target: { value: "Flight cancelled" } });
    fireEvent.click(within(form).getByRole("button", { name: "Record refund" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("needs an approver");
    expect(refundAction).not.toHaveBeenCalled();

    fireEvent.change(approver, { target: { value: "u-do" } });
    fireEvent.click(within(form).getByRole("button", { name: "Record refund" }));
    await screen.findByRole("status");
    expect(refundAction).toHaveBeenCalledWith("inv-1", expect.objectContaining({
      amount: "700.00",
      kind: "original_payment",
      paymentId: "pay-card",
      reason: "Flight cancelled",
      approverId: "u-do",
    }));
  });

  it("$500 and under needs no approver", () => {
    show();
    const form = open();
    fireEvent.change(within(form).getByLabelText("Amount"), { target: { value: "500.00" } });
    expect(within(form).queryByLabelText("Approved by")).not.toBeInTheDocument();
  });

  it("refuses more than came in, before the round trip", async () => {
    show();
    const form = open();
    fireEvent.change(within(form).getByLabelText("Amount"), { target: { value: "700.01" } });
    fireEvent.change(within(form).getByLabelText("Why"), { target: { value: "Overcharged" } });
    fireEvent.click(within(form).getByRole("button", { name: "Record refund" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That is more than the 700.00 received and not yet given back.",
    );
    expect(refundAction).not.toHaveBeenCalled();
  });

  it("a credit note needs no payment, and says what it does", async () => {
    show();
    const form = open();
    fireEvent.click(within(form).getByLabelText("As a credit note for a later invoice"));
    expect(within(form).queryByLabelText("Payment")).not.toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText("Amount"), { target: { value: "25.00" } });
    fireEvent.change(within(form).getByLabelText("Why"), { target: { value: "Goodwill" } });
    fireEvent.click(within(form).getByRole("button", { name: "Issue credit note" }));
    await screen.findByRole("status");
    expect(refundAction).toHaveBeenCalledWith(
      "inv-1",
      expect.objectContaining({ kind: "credit_note", amount: "25.00", approverId: "" }),
    );
  });

  it("a walk-in can't hold a credit note", () => {
    show({ hasCustomer: false });
    const form = open();
    expect(within(form).getByLabelText("As a credit note for a later invoice")).toBeDisabled();
    expect(form).toHaveTextContent("A walk-in can't hold a credit note.");
  });

  it("shows nothing at all when there is nothing given back or to give", () => {
    const { container } = show({ refunds: [], canRefund: false });
    expect(container).toBeEmptyDOMElement();
  });
});
