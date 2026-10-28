import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Paying an invoice from the customer's credit notes (#127). */

const { applyCreditAction } = vi.hoisted(() => ({ applyCreditAction: vi.fn() }));
vi.mock("../actions", () => ({ applyCreditAction }));

import { ApplyCredit } from "./apply-credit";

const NOTES = [
  { id: "cn-1", credit_number: "CN-000001", invoice_number: "INV-000003", refunded_on: "2026-10-01", remaining_cents: 15_000 },
  { id: "cn-2", credit_number: "CN-000002", invoice_number: "INV-000004", refunded_on: "2026-10-02", remaining_cents: 90_000 },
];

beforeEach(() => {
  vi.clearAllMocks();
  applyCreditAction.mockResolvedValue({ status: "ok", message: "Paid." });
});

describe("ApplyCredit (#127)", () => {
  it("says how much credit the customer has", () => {
    render(<ApplyCredit invoiceId="inv-9" creditNotes={NOTES} outstandingCents={40_000} canApply />);
    expect(screen.getByText(/The customer has 1,050.00 of credit\./)).toBeInTheDocument();
  });

  it("starts at what the note has left, or what the invoice owes", () => {
    render(<ApplyCredit invoiceId="inv-9" creditNotes={NOTES} outstandingCents={40_000} canApply />);
    fireEvent.click(screen.getByRole("button", { name: "Pay with credit" }));
    const form = screen.getByRole("form", { name: "Pay with credit" });
    expect(within(form).getByLabelText("Amount")).toHaveValue("150.00");
    fireEvent.change(within(form).getByLabelText("Credit note"), { target: { value: "cn-2" } });
    expect(within(form).getByLabelText("Amount")).toHaveValue("400.00");
  });

  it("applies it", async () => {
    render(<ApplyCredit invoiceId="inv-9" creditNotes={NOTES} outstandingCents={40_000} canApply />);
    fireEvent.click(screen.getByRole("button", { name: "Pay with credit" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply credit" }));
    await screen.findByRole("status");
    expect(applyCreditAction).toHaveBeenCalledWith("inv-9", "cn-1", "150.00", expect.any(String));
  });

  it("offers nothing without credit or without anything owed", () => {
    const { container: a } = render(
      <ApplyCredit invoiceId="inv-9" creditNotes={[]} outstandingCents={40_000} canApply />,
    );
    const { container: b } = render(
      <ApplyCredit invoiceId="inv-9" creditNotes={NOTES} outstandingCents={0} canApply={false} />,
    );
    expect(a).not.toHaveTextContent("Pay with credit");
    expect(b).not.toHaveTextContent("Pay with credit");
  });
});
