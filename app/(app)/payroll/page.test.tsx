import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PayEventRow } from "@/lib/api/payroll";

/**
 * /payroll — Pay Events list.
 *
 * The money and hours columns are the point of this page: a figure
 * formatted from the wrong field, or a date shifted by a timezone, is
 * the kind of wrong that still looks plausible on screen.
 */

// Pinned east of Greenwich on purpose. The date helpers are meant to be
// timezone-independent, but under the default TZ=UTC a naive local parse
// and the correct UTC parse produce identical output — so a date
// assertion run in UTC passes against the bug it is supposed to catch.
// In Tokyo a local parse of "2026-08-15" renders as Aug 14. Verified by
// mutation: reverting the page to a local parse fails the date test only
// with this line present.
process.env.TZ = "Asia/Tokyo";

const { TestApiError, listPayEvents, approvePayEventAction } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    TestApiError,
    listPayEvents: vi.fn(),
    approvePayEventAction: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
// The label map has to come through the mock too — the page imports it
// as a value, so an incomplete mock would render `undefined` in the Type
// column. Restating it here is what lets the test prove the page looks
// the label up rather than printing the raw enum.
vi.mock("@/lib/api/payroll", () => ({
  listPayEvents,
  PAY_EVENT_TYPE_LABELS: {
    flight_pay: "Flight Pay",
    duty_pay: "Duty Pay",
    training_pay: "Training Pay",
    standby_pay: "Standby Pay",
    per_diem: "Per Diem",
    expense: "Expense",
    overtime: "Overtime",
    deduction: "Deduction",
  },
}));
vi.mock("./actions", () => ({ approvePayEventAction }));

import PayrollEventsPage from "./page";

function event(over: Partial<PayEventRow> & { id: string }): PayEventRow {
  return {
    employee_user_id: "u-1",
    employee_name: "Alice Chen",
    event_type: "flight_pay",
    hours: "3.5",
    amount: "420.5",
    event_date: "2026-08-15",
    flight_id: null,
    status: "pending",
    approved_by_user_id: null,
    approved_at: null,
    pay_period_id: null,
    is_exported: false,
    description: null,
    notes: null,
    ...over,
  } as PayEventRow;
}

async function renderPage(searchParams: { status?: string | string[] } = {}) {
  const ui = await PayrollEventsPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

const rowFor = (name: string) =>
  screen.getByRole("row", { name: new RegExp(name) });

beforeEach(() => {
  listPayEvents.mockReset();
  approvePayEventAction.mockReset();
  listPayEvents.mockResolvedValue({ items: [] });
});

describe("status filter", () => {
  it("asks for everything when no status is given", async () => {
    await renderPage();
    expect(listPayEvents).toHaveBeenCalledWith({});
  });

  it("forwards a real status to the API", async () => {
    await renderPage({ status: "approved" });
    expect(listPayEvents).toHaveBeenCalledWith({ status: "approved" });
  });

  it("ignores a status the API would reject", async () => {
    // An unfiltered list is the safe fallback; forwarding "bogus" would
    // turn a typo in the URL into a 422 the user cannot act on.
    await renderPage({ status: "bogus" });
    expect(listPayEvents).toHaveBeenCalledWith({});
  });

  it("takes the first value when the param is repeated", async () => {
    await renderPage({ status: ["rejected", "approved"] });
    expect(listPayEvents).toHaveBeenCalledWith({ status: "rejected" });
  });

  it("marks the active tab and links the rest", async () => {
    await renderPage({ status: "exported" });
    expect(screen.getByRole("link", { name: "Exported" })).toHaveAttribute(
      "href",
      "/payroll?status=exported",
    );
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute(
      "href",
      "/payroll",
    );
  });
});

describe("load failures", () => {
  it.each([
    [401, /session expired/i],
    [403, /Exec Admin/i],
    [500, /unavailable/i],
  ])("explains a %i without pretending the list is empty", async (status, msg) => {
    listPayEvents.mockRejectedValueOnce(
      new TestApiError(status, "/payroll/events", "nope"),
    );
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(msg);
    // The "no pay events" empty state would be a lie here.
    expect(screen.queryByText(/No pay events found/i)).not.toBeInTheDocument();
  });

  it("treats a non-API failure as unavailable rather than crashing", async () => {
    listPayEvents.mockRejectedValueOnce(new Error("socket hang up"));
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });

  it("says the list is empty only when it really is", async () => {
    await renderPage();
    expect(screen.getByText(/No pay events found/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("the figures", () => {
  it("formats money to cents and hours to two places", async () => {
    listPayEvents.mockResolvedValueOnce({
      items: [event({ id: "e-1", hours: "3.5", amount: "420.5" })],
    });
    await renderPage();
    const row = rowFor("Alice Chen");
    expect(within(row).getByText("$420.50")).toBeInTheDocument();
    expect(within(row).getByText("3.50")).toBeInTheDocument();
  });

  it("dashes hours and amount when the event carries neither", async () => {
    // A per-diem row may have an amount and no hours; rendering 0.00
    // would claim the employee worked no time rather than that the
    // field does not apply.
    listPayEvents.mockResolvedValueOnce({
      items: [event({ id: "e-1", hours: null, amount: null })],
    });
    await renderPage();
    expect(within(rowFor("Alice Chen")).getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("does not confuse a zero amount with a missing one", async () => {
    listPayEvents.mockResolvedValueOnce({
      items: [event({ id: "e-1", amount: "0", hours: "0" })],
    });
    await renderPage();
    const row = rowFor("Alice Chen");
    expect(within(row).getByText("$0.00")).toBeInTheDocument();
    expect(within(row).getByText("0.00")).toBeInTheDocument();
  });

  it("renders the event date as the day the API sent, in any host zone", async () => {
    // The 15th must render as the 15th. Two independent ways to get this
    // wrong, and no single zone exposes both:
    //
    //   parsing "2026-08-15" in the host zone     breaks east of Greenwich
    //   formatting the Date without timeZone:UTC  breaks west of it
    //
    // Tokyo catches the first, Anchorage the second. Anchorage is also
    // where this operator actually flies.
    for (const tz of ["Asia/Tokyo", "America/Anchorage"]) {
      process.env.TZ = tz;
      listPayEvents.mockResolvedValueOnce({
        items: [event({ id: "e-1", event_date: "2026-08-15" })],
      });
      const { unmount } = await renderPage();
      expect(
        screen.getByText("Aug 15, 2026"),
        `event date shifted under TZ=${tz}`,
      ).toBeInTheDocument();
      unmount();
    }
    process.env.TZ = "Asia/Tokyo";
  });

  it("looks the type label up instead of printing the enum", async () => {
    listPayEvents.mockResolvedValueOnce({
      items: [event({ id: "e-1", event_type: "per_diem" })],
    });
    await renderPage();
    expect(screen.getByText("Per Diem")).toBeInTheDocument();
    expect(screen.queryByText("per_diem")).not.toBeInTheDocument();
  });

  it("dashes an employee the API could not name", async () => {
    listPayEvents.mockResolvedValueOnce({
      items: [event({ id: "e-1", employee_name: null })],
    });
    await renderPage();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("counts the events, singular and plural", async () => {
    listPayEvents.mockResolvedValueOnce({ items: [event({ id: "e-1" })] });
    const { unmount } = await renderPage();
    expect(screen.getByText("1 event")).toBeInTheDocument();
    unmount();

    listPayEvents.mockResolvedValueOnce({
      items: [event({ id: "e-1" }), event({ id: "e-2" })],
    });
    await renderPage();
    expect(screen.getByText("2 events")).toBeInTheDocument();
  });
});

describe("approve / reject", () => {
  it("offers the actions on a pending event", async () => {
    listPayEvents.mockResolvedValueOnce({
      items: [event({ id: "e-1", status: "pending", is_exported: false })],
    });
    await renderPage();
    const row = rowFor("Alice Chen");
    expect(within(row).getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it.each(["approved", "rejected", "exported"] as const)(
    "withholds them once the event is %s",
    async (status) => {
      listPayEvents.mockResolvedValueOnce({
        items: [event({ id: "e-1", status })],
      });
      await renderPage();
      expect(
        within(rowFor("Alice Chen")).queryByRole("button", { name: "Approve" }),
      ).not.toBeInTheDocument();
    },
  );

  it("withholds them on a pending event already exported", async () => {
    // Both halves of the guard matter: an exported row is in a locked
    // period, so approving it would change a figure already sent to the
    // payroll provider.
    listPayEvents.mockResolvedValueOnce({
      items: [event({ id: "e-1", status: "pending", is_exported: true })],
    });
    await renderPage();
    expect(
      within(rowFor("Alice Chen")).queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
  });
});

describe("status badge", () => {
  it.each([
    ["pending", "Pending"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["exported", "Exported"],
  ] as const)("labels a %s event", async (status, label) => {
    listPayEvents.mockResolvedValueOnce({
      items: [event({ id: "e-1", status })],
    });
    await renderPage();
    expect(within(rowFor("Alice Chen")).getByText(label)).toBeInTheDocument();
  });
});
