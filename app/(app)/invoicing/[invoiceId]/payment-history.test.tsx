import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CustomerPayment } from "@/lib/api/customer-invoices";
import { expectNoA11yViolations } from "@/tests/a11y";

const { voidPaymentAction } = vi.hoisted(() => ({ voidPaymentAction: vi.fn() }));
vi.mock("../actions", () => ({ voidPaymentAction }));

import { PaymentHistory } from "./payment-history";

function payment(over: Partial<CustomerPayment> & { id: string }): CustomerPayment {
  return {
    amount_cents: 60_000,
    method: "check",
    received_on: "2026-10-01",
    reference: null,
    notes: null,
    voided_at: null,
    voided_by: null,
    void_reason: null,
    ...over,
  };
}

const card = payment({
  id: "pay-1",
  amount_cents: 40_000,
  method: "card",
  received_on: "2026-09-28",
  reference: "auth 55AX",
});
const check = payment({ id: "pay-2", reference: "1042" });

function renderHistory(payments: CustomerPayment[] = [card, check]) {
  return render(
    <PaymentHistory invoiceId="inv-1" invoiceNumber="INV-000007" payments={payments} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  voidPaymentAction.mockResolvedValue({
    status: "ok",
    message: "Voided the 600.00 (Check) payment. 600.00 outstanding.",
  });
});

describe("PaymentHistory", () => {
  it("says so when nothing has been paid", () => {
    renderHistory([]);
    expect(screen.getByText("No payments recorded.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("lists each payment with its date, method, reference and amount", () => {
    renderHistory();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    // Header, then the two payments in the order given (oldest first).
    expect(rows[1]).toHaveTextContent("2026-09-28");
    expect(rows[1]).toHaveTextContent("Card");
    expect(rows[1]).toHaveTextContent("auth 55AX");
    expect(rows[1]).toHaveTextContent("400.00");
    expect(rows[2]).toHaveTextContent("Check");
    expect(rows[2]).toHaveTextContent("600.00");
  });

  it("asks which payment, how much and why before voiding one", async () => {
    const user = userEvent.setup();
    const { container } = renderHistory();
    await user.click(
      screen.getByRole("button", { name: "Void payment of 600.00 (Check)" }),
    );

    const confirm = screen.getByRole("group", { name: "Void a payment" });
    expect(confirm).toHaveTextContent("Void the 600.00 Check payment received 2026-10-01?");
    const button = within(confirm).getByRole("button", { name: "Confirm void" });
    expect(button).toBeDisabled();
    await user.type(within(confirm).getByLabelText("Why is it being voided?"), "  ");
    expect(button).toBeDisabled();
    await expectNoA11yViolations(container);

    await user.type(
      within(confirm).getByLabelText("Why is it being voided?"),
      "Check returned unpaid",
    );
    expect(button).toBeEnabled();
    await user.click(button);
    await waitFor(() =>
      expect(voidPaymentAction).toHaveBeenCalledWith(
        "inv-1",
        "pay-2",
        "  Check returned unpaid",
      ),
    );
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Voided the 600.00 (Check) payment.");
    expect(status).toHaveFocus();
    expect(screen.queryByRole("group", { name: "Void a payment" })).not.toBeInTheDocument();
  });

  it("shows a voided payment as voided, with its reason, and offers no void", () => {
    renderHistory([
      card,
      payment({
        id: "pay-2",
        voided_at: "2026-10-02T16:40:00Z",
        voided_by: "u-1",
        void_reason: "Check returned unpaid",
      }),
    ]);
    expect(screen.getByText("Voided")).toBeInTheDocument();
    expect(screen.getByText(/Check returned unpaid/)).toBeInTheDocument();
    // The voided amount is struck through, not left looking paid.
    expect(screen.getByText("600.00").tagName).toBe("S");
    expect(
      screen.queryByRole("button", { name: /Void payment of 600\.00/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Void payment of 400.00 (Card)" }),
    ).toBeInTheDocument();
  });

  it("keeps the confirm open and says why when the void is refused", async () => {
    voidPaymentAction.mockResolvedValueOnce({
      status: "error",
      message: "That payment has already been voided.",
    });
    const user = userEvent.setup();
    renderHistory();
    await user.click(
      screen.getByRole("button", { name: "Void payment of 400.00 (Card)" }),
    );
    await user.type(screen.getByLabelText("Why is it being voided?"), "Typo");
    await user.click(screen.getByRole("button", { name: "Confirm void" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That payment has already been voided.",
    );
    expect(screen.getByRole("group", { name: "Void a payment" })).toBeInTheDocument();
  });

  it("lets a long unbroken reference wrap rather than push the amount away", () => {
    renderHistory([
      payment({ id: "pay-3", reference: "20261002MMQFMP2K000123ABCDEFGHIJKLMNOPQR" }),
    ]);
    const cell = screen.getByText("20261002MMQFMP2K000123ABCDEFGHIJKLMNOPQR");
    expect(cell.className).toContain("[overflow-wrap:anywhere]");
    expect(screen.getByText("2026-10-01").className).toContain("whitespace-nowrap");
  });
});
