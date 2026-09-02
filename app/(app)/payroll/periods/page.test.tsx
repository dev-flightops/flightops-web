import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PayPeriodRow } from "@/lib/api/payroll";

/**
 * /payroll/periods — the list a payroll admin locks and exports from.
 *
 * Locking is one-way and export sends figures to an outside provider, so
 * what matters here is that each row shows the right period boundaries
 * and the right state, and that the controls are handed the identity of
 * the row they sit on.
 */

// East of Greenwich: a bare YYYY-MM-DD parsed in the host zone renders as
// the day before, and period boundaries are exactly where an off-by-one
// day changes which events fall inside the period.
process.env.TZ = "Asia/Tokyo";

const { TestApiError, listPayPeriods } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, listPayPeriods: vi.fn() };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/payroll", () => ({ listPayPeriods }));

// Both are client components built on useActionState, which React 18
// cannot render under vitest. Stubbed so the props they are given stay
// observable — that is the part of the contract this page owns.
vi.mock("./period-controls", () => ({
  NewPeriodForm: () => <div data-testid="new-period-form" />,
  LockExportButtons: (props: {
    periodId: string;
    status: string;
    startIso: string;
    endIso: string;
  }) => (
    <div
      data-testid="lock-export"
      data-period-id={props.periodId}
      data-status={props.status}
      data-start={props.startIso}
      data-end={props.endIso}
    />
  ),
}));

import PayrollPeriodsPage from "./page";

function period(over: Partial<PayPeriodRow> & { id: string }): PayPeriodRow {
  return {
    period_start: "2026-08-01",
    period_end: "2026-08-15",
    status: "open",
    locked_at: null,
    locked_by_user_id: null,
    exported_at: null,
    exported_by_user_id: null,
    ...over,
  } as PayPeriodRow;
}

const renderPage = async () => render(await PayrollPeriodsPage());

beforeEach(() => {
  listPayPeriods.mockReset();
  listPayPeriods.mockResolvedValue({ items: [] });
});

describe("loading", () => {
  it("asks for a bounded page rather than the whole table", async () => {
    await renderPage();
    expect(listPayPeriods).toHaveBeenCalledWith({ limit: 50 });
  });

  it.each([
    [401, /session expired/i],
    [403, /Exec Admin/i],
    [500, /unavailable/i],
  ])("explains a %i instead of showing an empty list", async (status, msg) => {
    listPayPeriods.mockRejectedValueOnce(
      new TestApiError(status, "/payroll/periods", "nope"),
    );
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(msg);
    expect(screen.queryByText(/No pay periods defined/i)).not.toBeInTheDocument();
  });

  it("treats a non-API failure as unavailable", async () => {
    listPayPeriods.mockRejectedValueOnce(new Error("ECONNRESET"));
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });

  it("invites a first period when there are none", async () => {
    await renderPage();
    expect(screen.getByText(/No pay periods defined yet/i)).toBeInTheDocument();
  });

  it("keeps the create form available even when the list fails to load", async () => {
    // Being unable to read the list is not a reason to block creating a
    // period — the form posts to a different endpoint.
    listPayPeriods.mockRejectedValueOnce(
      new TestApiError(500, "/payroll/periods", "nope"),
    );
    await renderPage();
    expect(screen.getByTestId("new-period-form")).toBeInTheDocument();
  });
});

describe("period rows", () => {
  it("renders the boundaries as the days the API sent, in any host zone", async () => {
    for (const tz of ["Asia/Tokyo", "America/Anchorage"]) {
      process.env.TZ = tz;
      listPayPeriods.mockResolvedValueOnce({
        items: [
          period({ id: "p-1", period_start: "2026-08-01", period_end: "2026-08-15" }),
        ],
      });
      const { unmount } = await renderPage();
      expect(
        screen.getByText(/Aug 01, 2026\s*—\s*Aug 15, 2026/),
        `period boundaries shifted under TZ=${tz}`,
      ).toBeInTheDocument();
      unmount();
    }
    process.env.TZ = "Asia/Tokyo";
  });

  it.each([
    ["open", "Open"],
    ["review", "Review"],
    ["locked", "Locked"],
    ["exported", "Exported"],
  ] as const)("labels a %s period", async (status, label) => {
    listPayPeriods.mockResolvedValueOnce({
      items: [period({ id: "p-1", status })],
    });
    await renderPage();
    const row = screen.getByRole("row", { name: /Aug 01, 2026/ });
    expect(within(row).getByText(label)).toBeInTheDocument();
  });

  it("dashes the lock and export timestamps while they are unset", async () => {
    listPayPeriods.mockResolvedValueOnce({
      items: [period({ id: "p-1", locked_at: null, exported_at: null })],
    });
    await renderPage();
    const row = screen.getByRole("row", { name: /Aug 01, 2026/ });
    expect(within(row).getAllByText("—")).toHaveLength(2);
  });

  it("shows a timestamp once the period is locked", async () => {
    listPayPeriods.mockResolvedValueOnce({
      items: [
        period({
          id: "p-1",
          status: "locked",
          locked_at: "2026-08-16T14:30:00Z",
        }),
      ],
    });
    await renderPage();
    const row = screen.getByRole("row", { name: /Aug 01, 2026/ });
    // Rendered in the host zone rather than UTC, so the exact clock time
    // is not asserted — only that the row stops claiming it is unlocked.
    expect(within(row).getAllByText("—")).toHaveLength(1);
    expect(within(row).getByText(/Aug 1[67], 2026/)).toBeInTheDocument();
  });

  it("hands each row's controls that row's own period", async () => {
    // Two rows, so a hardcoded or last-wins prop cannot pass.
    listPayPeriods.mockResolvedValueOnce({
      items: [
        period({ id: "p-1", period_start: "2026-08-01", period_end: "2026-08-15", status: "open" }),
        period({ id: "p-2", period_start: "2026-08-16", period_end: "2026-08-31", status: "locked" }),
      ],
    });
    await renderPage();
    const controls = screen.getAllByTestId("lock-export");
    expect(controls).toHaveLength(2);
    expect(controls[0]).toHaveAttribute("data-period-id", "p-1");
    expect(controls[0]).toHaveAttribute("data-status", "open");
    expect(controls[0]).toHaveAttribute("data-start", "2026-08-01");
    expect(controls[1]).toHaveAttribute("data-period-id", "p-2");
    expect(controls[1]).toHaveAttribute("data-status", "locked");
    expect(controls[1]).toHaveAttribute("data-end", "2026-08-31");
  });

  it("passes the raw ISO dates to the controls, not the formatted ones", async () => {
    // The controls post these back to the API, which wants YYYY-MM-DD.
    listPayPeriods.mockResolvedValueOnce({
      items: [period({ id: "p-1", period_start: "2026-08-01" })],
    });
    await renderPage();
    expect(screen.getByTestId("lock-export")).toHaveAttribute(
      "data-start",
      "2026-08-01",
    );
  });
});

describe("navigation", () => {
  it("links back to the events list", async () => {
    await renderPage();
    expect(screen.getByRole("link", { name: "Pay Events" })).toHaveAttribute(
      "href",
      "/payroll",
    );
  });
});
