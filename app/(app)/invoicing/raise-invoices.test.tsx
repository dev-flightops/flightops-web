import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

const { raiseInvoicesAction, flownFlightsOnAction } = vi.hoisted(() => ({
  raiseInvoicesAction: vi.fn(),
  flownFlightsOnAction: vi.fn(),
}));
vi.mock("./raise-actions", () => ({
  raiseInvoicesAction,
  flownFlightsOnAction,
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
  // Only Date is faked, so user-event's timers still run. 15:00z on
  // 4 Oct is still 4 Oct in UTC, the day the panel opens on.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T15:00:00Z"));
  flownFlightsOnAction.mockResolvedValue({
    status: "ok",
    flights: FLIGHTS,
    truncated: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

async function openPanel() {
  const user = userEvent.setup();
  const utils = render(<RaiseInvoices />);
  await user.click(screen.getByRole("button", { name: "Raise invoices" }));
  await screen.findByLabelText("Flown flight");
  return { user, ...utils };
}

describe("Raise invoices", () => {
  it("offers today's flown flights, newest first, once opened", async () => {
    const { container } = await openPanel();
    expect(screen.getByLabelText("Flown on (UTC)")).toHaveValue("2026-10-04");
    expect(screen.getByLabelText("Flown on (UTC)")).toHaveAttribute(
      "max",
      "2026-10-04",
    );
    expect(flownFlightsOnAction).toHaveBeenCalledTimes(1);
    expect(flownFlightsOnAction).toHaveBeenCalledWith("2026-10-04");
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
      skipped: [{ customer: "Bob Kalskag", reason: "customer already has INV-000002 for this flight; a booking added after INV-000002 was raised is not on it: void INV-000002 and raise again to include it" }],
      notes: [],
    });
    const { user } = await openPanel();
    await user.selectOptions(screen.getByLabelText("Flown flight"), "f-2");
    await user.click(screen.getByRole("button", { name: "Raise" }));
    expect(await screen.findByText("No new invoices")).toBeInTheDocument();
    expect(screen.getByText("Bob Kalskag").textContent).toBe(
      "Bob Kalskag — customer already has INV-000002 for this flight; a booking added after INV-000002 was raised is not on it: void INV-000002 and raise again to include it",
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

  it("says when no flight flew that day", async () => {
    flownFlightsOnAction.mockResolvedValue({
      status: "ok",
      flights: [],
      truncated: false,
    });
    const user = userEvent.setup();
    render(<RaiseInvoices />);
    await user.click(screen.getByRole("button", { name: "Raise invoices" }));
    expect(
      await screen.findByText(
        "No flight flew on Oct 4, 2026 (UTC). A flight counts as flown once its arrival is recorded.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raise" })).not.toBeInTheDocument();
    // The day can still be changed, and the panel closed.
    expect(screen.getByLabelText("Flown on (UTC)")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("says when the flights could not be loaded", async () => {
    flownFlightsOnAction.mockResolvedValue({
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
    expect(flownFlightsOnAction).toHaveBeenCalledTimes(2);
  });
});

describe("picking the day (R1)", () => {
  it("lists the flights of the day chosen, however long ago", async () => {
    const older = [
      { id: "f-old", label: "PGR201 · PANC → PAOM · Mar 3, 16:00z · N733RX" },
    ];
    const { user } = await openPanel();
    flownFlightsOnAction.mockResolvedValue({
      status: "ok",
      flights: older,
      truncated: false,
    });

    await user.clear(screen.getByLabelText("Flown on (UTC)"));
    await user.type(screen.getByLabelText("Flown on (UTC)"), "2026-03-03");

    expect(flownFlightsOnAction).toHaveBeenLastCalledWith("2026-03-03");
    await screen.findByRole("option", { name: older[0].label });
    expect(
      within(screen.getByLabelText("Flown flight"))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Choose a flight…", older[0].label]);
  });

  it("raises the flight chosen on that day", async () => {
    raiseInvoicesAction.mockResolvedValue({
      status: "ok",
      created: [],
      skipped: [],
      notes: [],
    });
    const { user } = await openPanel();
    flownFlightsOnAction.mockResolvedValue({
      status: "ok",
      flights: [{ id: "f-old", label: "PGR201 · PANC → PAOM · Mar 3, 16:00z · N733RX" }],
      truncated: false,
    });
    await user.clear(screen.getByLabelText("Flown on (UTC)"));
    await user.type(screen.getByLabelText("Flown on (UTC)"), "2026-03-03");
    await screen.findByRole("option", { name: /PGR201/ });
    await user.selectOptions(screen.getByLabelText("Flown flight"), "f-old");
    await user.click(screen.getByRole("button", { name: "Raise" }));
    expect(raiseInvoicesAction).toHaveBeenCalledWith("f-old");
  });

  it("keeps the later day's list when an earlier answer arrives last", async () => {
    let answerFirst: (v: unknown) => void = () => {};
    const { user } = await openPanel();
    flownFlightsOnAction
      .mockImplementationOnce(
        () => new Promise((resolve) => (answerFirst = resolve)),
      )
      .mockResolvedValueOnce({
        status: "ok",
        flights: [{ id: "f-2nd", label: "PGR202 · PANC → PAOM · Mar 4, 16:00z · N733RX" }],
        truncated: false,
      });
    const date = screen.getByLabelText("Flown on (UTC)");
    // Two whole dates, one after the other: 3 then 4 March.
    await user.clear(date);
    await user.type(date, "2026-03-03");
    await user.clear(date);
    await user.type(date, "2026-03-04");
    await screen.findByRole("option", { name: /PGR202/ });

    answerFirst({
      status: "ok",
      flights: [{ id: "f-1st", label: "PGR201 · PANC → PAOM · Mar 3, 16:00z · N733RX" }],
      truncated: false,
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("option", { name: /PGR201/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /PGR202/ })).toBeInTheDocument();
  });

  it("says when more flew that day than one list holds", async () => {
    flownFlightsOnAction.mockResolvedValue({
      status: "ok",
      flights: FLIGHTS,
      truncated: true,
    });
    await openPanel();
    expect(
      screen.getByText(
        "Showing the first 2 flights flown that day; more flew than one list holds.",
      ),
    ).toBeInTheDocument();
  });
});
