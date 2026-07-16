import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  CurrencyItemRef,
  CurrencyStatus,
  PilotComplianceRow,
  PilotCurrencyCell,
} from "@/lib/api/types";

import {
  buildCalendarEntries,
  ComplianceCalendar,
} from "./compliance-calendar";

function calItem(
  over: Partial<CurrencyItemRef> & { id: string; code: string },
): CurrencyItemRef {
  return {
    name: over.code,
    regulation: "14 CFR 135.293",
    interval_type: "annual",
    requires_examiner: false,
    is_check_event: false,
    is_initial_only: false,
    rolling_days: null,
    rolling_threshold: null,
    sort_order: 100,
    is_default: true,
    is_active: true,
    ...over,
  };
}

function rollItem(
  over: Partial<CurrencyItemRef> & { id: string; code: string },
): CurrencyItemRef {
  return {
    name: over.code,
    regulation: "14 CFR 61.57",
    interval_type: "rolling_days",
    requires_examiner: false,
    is_check_event: false,
    is_initial_only: false,
    rolling_days: 90,
    rolling_threshold: 3,
    sort_order: 200,
    is_default: true,
    is_active: true,
    ...over,
  };
}

function cell(
  itemId: string,
  status: CurrencyStatus,
  over: Partial<PilotCurrencyCell> = {},
): PilotCurrencyCell {
  return {
    currency_item_id: itemId,
    status,
    last_completed_date: null,
    base_month_due: null,
    grace_month_end: null,
    rolling_count: null,
    ...over,
  };
}

function row(
  pilotId: string,
  pilotName: string,
  cells: PilotCurrencyCell[],
): PilotComplianceRow {
  return {
    pilot: { id: pilotId, full_name: pilotName, email: `${pilotId}@x.test` },
    overall_status: "due_this_month",
    cells,
  };
}

describe("buildCalendarEntries", () => {
  it("buckets non-rolling cells by base_month_due", () => {
    const items = [calItem({ id: "i-1", code: "ipc" })];
    const rows = [
      row("p-1", "Alice", [
        cell("i-1", "due_this_month", { base_month_due: "2026-08-01" }),
      ]),
    ];
    const out = buildCalendarEntries(items, rows, null);
    expect(out.byMonth.get("2026-08")?.length).toBe(1);
    expect(out.rolling).toHaveLength(0);
  });

  it("anchors grace cells on grace_month_end month, not base_month_due", () => {
    const items = [calItem({ id: "i-1", code: "ipc" })];
    const rows = [
      row("p-1", "Alice", [
        cell("i-1", "grace_month", {
          base_month_due: "2026-07-01",
          grace_month_end: "2026-08-31",
        }),
      ]),
    ];
    const out = buildCalendarEntries(items, rows, null);
    expect(out.byMonth.get("2026-08")?.length).toBe(1);
    expect(out.byMonth.get("2026-07")).toBeUndefined();
  });

  it("routes rolling-days cells to the rolling lane (not the calendar)", () => {
    const items = [rollItem({ id: "r-1", code: "day_landing" })];
    const rows = [
      row("p-1", "Alice", [
        cell("r-1", "due_this_month", {
          rolling_count: 1,
        }),
      ]),
    ];
    const out = buildCalendarEntries(items, rows, null);
    expect(out.byMonth.size).toBe(0);
    expect(out.rolling).toHaveLength(1);
  });

  it("hides not_started + upcoming rolling-days items from the rolling lane", () => {
    const items = [rollItem({ id: "r-1", code: "day_landing" })];
    const rows = [
      row("p-1", "Alice", [cell("r-1", "upcoming", { rolling_count: 0 })]),
    ];
    const out = buildCalendarEntries(items, rows, null);
    expect(out.rolling).toHaveLength(0);
  });
});

describe("ComplianceCalendar", () => {
  it("renders 6 month cells with the current month leftmost", () => {
    render(
      <ComplianceCalendar
        items={[]}
        rows={[]}
        statusFilter={null}
        today={new Date(Date.UTC(2026, 5, 15))} // 2026-06-15
      />,
    );
    expect(screen.getByText("Jun 2026")).toBeInTheDocument();
    expect(screen.getByText("Nov 2026")).toBeInTheDocument();
    // 6 "Nothing scheduled" slots when there's no data.
    expect(screen.getAllByText(/nothing scheduled/i)).toHaveLength(6);
  });

  it("renders a pilot card in the right month cell", () => {
    const items = [calItem({ id: "i-1", code: "ipc", name: "IPC" })];
    const rows = [
      row("p-1", "Alice", [
        cell("i-1", "due_this_month", { base_month_due: "2026-09-01" }),
      ]),
    ];
    render(
      <ComplianceCalendar
        items={items}
        rows={rows}
        statusFilter={null}
        today={new Date(Date.UTC(2026, 5, 15))}
      />,
    );
    expect(screen.getByRole("link", { name: "Alice" })).toHaveAttribute(
      "href",
      "/compliance/pilots/p-1",
    );
    expect(screen.getByText("IPC")).toBeInTheDocument();
  });

  it("renders a rolling-items lane when rolling cells are present", () => {
    const items = [
      rollItem({ id: "r-1", code: "day_landing", name: "Day Landings" }),
    ];
    const rows = [
      row("p-1", "Alice", [
        cell("r-1", "due_this_month", { rolling_count: 1 }),
      ]),
    ];
    render(
      <ComplianceCalendar
        items={items}
        rows={rows}
        statusFilter={null}
        today={new Date(Date.UTC(2026, 5, 15))}
      />,
    );
    expect(screen.getByText(/rolling-window items/i)).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("shows +N overflow when a month has more than the max chips", () => {
    const items = [calItem({ id: "i-1", code: "ipc" })];
    // 6 different pilots all due in the same month → 4 shown + "+2 more".
    const rows = Array.from({ length: 6 }, (_, i) =>
      row(`p-${i}`, `Pilot ${i}`, [
        cell("i-1", "due_this_month", { base_month_due: "2026-09-01" }),
      ]),
    );
    render(
      <ComplianceCalendar
        items={items}
        rows={rows}
        statusFilter={null}
        today={new Date(Date.UTC(2026, 5, 15))}
      />,
    );
    expect(screen.getByText(/\+2 more/)).toBeInTheDocument();
  });
});
