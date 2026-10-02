import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

const { raiseInvoicesAction, recentFlownFlightsAction } = vi.hoisted(() => ({
  raiseInvoicesAction: vi.fn(),
  recentFlownFlightsAction: vi.fn(),
}));
vi.mock("./raise-actions", () => ({
  raiseInvoicesAction,
  recentFlownFlightsAction,
}));

import { RaiseInvoices } from "./raise-invoices";

/**
 * Raise invoices on /invoicing: pick a flown flight, raise it, and the
 * panel lists the invoices created (by number) and the bookings that
 * were not invoiced, with the reasons.
 */

const FLIGHTS = [
  { id: "f-2", label: "PGR734 · PANC → PAOM · Sep 29, 16:00z · N733RX" },
  { id: "f-1", label: "PGR733 · PANC → PAOM · Sep 28, 16:00z · N733RX" },
];

beforeEach(() => {
  vi.clearAllMocks();
  recentFlownFlightsAction.mockResolvedValue({ status: "ok", flights: FLIGHTS });
});

async function openPanel() {
  const user = userEvent.setup();
  const utils = render(<RaiseInvoices />);
  await user.click(screen.getByRole("button", { name: "Raise invoices" }));
  await screen.findByLabelText("Flown flight");
  return { user, ...utils };
}

describe("Raise invoices", () => {
  it("offers the flown flights, newest first, once opened", async () => {
    const { container } = await openPanel();
    expect(recentFlownFlightsAction).toHaveBeenCalledTimes(1);
    const options = within(screen.getByLabelText("Flown flight")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Choose a flight…",
      FLIGHTS[0].label,
      FLIGHTS[1].label,
    ]);
    // Nothing to raise until a flight is chosen.
    expect(screen.getByRole("button", { name: "Raise" })).toBeDisabled();
    await expectNoA11yViolations(container);
  });

  it("lists the invoices created and the bookings skipped, with reasons", async () => {
    raiseInvoicesAction.mockResolvedValue({
      status: "ok",
      created: [
        {
          id: "inv-1",
          invoiceNumber: "INV-000001",
          customer: "A <b>&</b> Co",
          totalCents: 134_139,
          hasUnpricedLines: false,
        },
        {
          id: "inv-2",
          invoiceNumber: "INV-000002",
          customer: "Bob Kalskag",
          totalCents: 48_375,
          hasUnpricedLines: false,
        },
      ],
      skipped: [{ customer: "Late Canceller", reason: "cancelled" }],
      notes: [
        "Cargo (100.0 lb) is billed on INV-000001 to A <b>&</b> Co, the first customer booked on this flight.",
      ],
    });
    const { user, container } = await openPanel();
    await user.selectOptions(screen.getByLabelText("Flown flight"), "f-1");
    await user.click(screen.getByRole("button", { name: "Raise" }));

    expect(raiseInvoicesAction).toHaveBeenCalledWith("f-1");
    expect(await screen.findByText("Created 2 draft invoices")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "INV-000001" })).toHaveAttribute(
      "href",
      "/invoicing/inv-1",
    );
    expect(screen.getByRole("link", { name: "INV-000002" })).toHaveAttribute(
      "href",
      "/invoicing/inv-2",
    );
    expect(screen.getByText("1,341.39")).toBeInTheDocument();
    expect(screen.getByText("Not invoiced")).toBeInTheDocument();
    expect(screen.getByText("Late Canceller").textContent).toBe(
      "Late Canceller — cancelled",
    );
    expect(
      screen.getByText(
        "Cargo (100.0 lb) is billed on INV-000001 to A <b>&</b> Co, the first customer booked on this flight.",
      ),
    ).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("says when there was nothing new to raise", async () => {
    raiseInvoicesAction.mockResolvedValue({
      status: "ok",
      created: [],
      skipped: [{ customer: "Bob Kalskag", reason: "already invoiced on INV-000002" }],
      notes: [],
    });
    const { user } = await openPanel();
    await user.selectOptions(screen.getByLabelText("Flown flight"), "f-2");
    await user.click(screen.getByRole("button", { name: "Raise" }));
    expect(await screen.findByText("No new invoices")).toBeInTheDocument();
    expect(screen.getByText("Bob Kalskag").textContent).toBe(
      "Bob Kalskag — already invoiced on INV-000002",
    );
  });

  it("flags a created invoice that still needs pricing", async () => {
    raiseInvoicesAction.mockResolvedValue({
      status: "ok",
      created: [
        {
          id: "inv-3",
          invoiceNumber: "INV-000003",
          customer: "A <b>&</b> Co",
          totalCents: 120_030,
          hasUnpricedLines: true,
        },
      ],
      skipped: [],
      notes: [],
    });
    const { user } = await openPanel();
    await user.selectOptions(screen.getByLabelText("Flown flight"), "f-1");
    await user.click(screen.getByRole("button", { name: "Raise" }));
    expect(await screen.findByText("needs pricing")).toBeInTheDocument();
  });

  it("shows a refusal in words", async () => {
    raiseInvoicesAction.mockResolvedValue({
      status: "error",
      message:
        "This flight's invoices are being raised right now, in another tab or by someone else. Wait a moment, then check the list below.",
    });
    const { user } = await openPanel();
    await user.selectOptions(screen.getByLabelText("Flown flight"), "f-1");
    await user.click(screen.getByRole("button", { name: "Raise" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This flight's invoices are being raised right now",
    );
  });

  it("says when no flight has flown yet", async () => {
    recentFlownFlightsAction.mockResolvedValue({ status: "ok", flights: [] });
    const user = userEvent.setup();
    render(<RaiseInvoices />);
    await user.click(screen.getByRole("button", { name: "Raise invoices" }));
    expect(
      await screen.findByText(
        "No flown flights yet. A flight counts as flown once its arrival is recorded.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raise" })).not.toBeInTheDocument();
  });

  it("says when the flights could not be loaded", async () => {
    recentFlownFlightsAction.mockResolvedValue({
      status: "error",
      message: "Could not load the flown flights (HTTP 503).",
    });
    const user = userEvent.setup();
    render(<RaiseInvoices />);
    await user.click(screen.getByRole("button", { name: "Raise invoices" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not load the flown flights (HTTP 503).",
      ),
    );
  });

  it("closes, and opens again on a fresh list", async () => {
    const { user } = await openPanel();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByLabelText("Flown flight")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Raise invoices" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await user.click(screen.getByRole("button", { name: "Raise invoices" }));
    await screen.findByLabelText("Flown flight");
    expect(recentFlownFlightsAction).toHaveBeenCalledTimes(2);
  });
});
