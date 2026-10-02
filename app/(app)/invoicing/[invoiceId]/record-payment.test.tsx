import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

const { recordPaymentAction } = vi.hoisted(() => ({
  recordPaymentAction: vi.fn(),
}));
vi.mock("../actions", () => ({ recordPaymentAction }));
vi.mock("../payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../payments")>()),
  todayLocalIsoDate: () => "2026-10-02",
}));

import { RecordPayment } from "./record-payment";

beforeEach(() => {
  vi.clearAllMocks();
  recordPaymentAction.mockResolvedValue({
    status: "ok",
    message: "Recorded 250.00 (Cash). 750.00 still outstanding.",
  });
});

async function openForm(outstandingCents = 100_000) {
  const user = userEvent.setup();
  const view = render(
    <RecordPayment invoiceId="inv-1" outstandingCents={outstandingCents} />,
  );
  await user.click(screen.getByRole("button", { name: "Record payment" }));
  return { user, ...view };
}

describe("RecordPayment", () => {
  it("starts at the outstanding balance, today, and no method chosen", async () => {
    const { container } = await openForm(60_000);
    expect(screen.getByLabelText("Amount")).toHaveValue("600.00");
    expect(screen.getByLabelText("Received")).toHaveValue("2026-10-02");
    expect(screen.getByLabelText("Received")).toHaveAttribute("max", "2026-10-02");
    expect(screen.getByLabelText("Method")).toHaveValue("");
    expect(screen.getByLabelText("Reference")).toHaveValue("");
    await expectNoA11yViolations(container);
  });

  it("records a part payment with what was typed", async () => {
    const { user } = await openForm();
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "250");
    await user.selectOptions(screen.getByLabelText("Method"), "cash");
    await user.type(screen.getByLabelText("Reference"), "receipt 0042");
    await user.click(screen.getByRole("button", { name: "Record payment" }));

    await waitFor(() =>
      expect(recordPaymentAction).toHaveBeenCalledWith("inv-1", {
        amount: "250",
        method: "cash",
        receivedOn: "2026-10-02",
        reference: "receipt 0042",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Recorded 250.00 (Cash). 750.00 still outstanding.",
    );
    // The form closes; the page re-renders with the new balance.
    expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument();
  });

  it("will not send more than is outstanding", async () => {
    const { user } = await openForm(60_000);
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "600.01");
    await user.selectOptions(screen.getByLabelText("Method"), "check");
    await user.click(screen.getByRole("button", { name: "Record payment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That is more than the 600.00 outstanding.",
    );
    expect(recordPaymentAction).not.toHaveBeenCalled();
  });

  it("needs a method", async () => {
    const { user } = await openForm();
    await user.click(screen.getByRole("button", { name: "Record payment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose how the money arrived.",
    );
    expect(recordPaymentAction).not.toHaveBeenCalled();
  });

  it("will not send an amount that is not one", async () => {
    const { user } = await openForm();
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "12,5");
    await user.selectOptions(screen.getByLabelText("Method"), "card");
    await user.click(screen.getByRole("button", { name: "Record payment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter the amount received, like 250.00.",
    );
    expect(recordPaymentAction).not.toHaveBeenCalled();
  });

  it("shows the service's refusal and keeps the form open", async () => {
    recordPaymentAction.mockResolvedValueOnce({
      status: "error",
      message: "That is more than the 400.00 still outstanding.",
    });
    const { user } = await openForm();
    await user.selectOptions(screen.getByLabelText("Method"), "other");
    await user.click(screen.getByRole("button", { name: "Record payment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That is more than the 400.00 still outstanding.",
    );
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
  });
});
