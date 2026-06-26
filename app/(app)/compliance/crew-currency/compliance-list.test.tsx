import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  CurrencyItemRef,
  CurrencyStatus,
  PilotComplianceRow,
  PilotCurrencyCell,
} from "@/lib/api/types";

import {
  buildListEntries,
  ComplianceList,
} from "./compliance-list";

function calendarItem(
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
    ...over,
  };
}

function rollingItem(
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
  overall: CurrencyStatus = "due_this_month",
): PilotComplianceRow {
  return {
    pilot: { id: pilotId, full_name: pilotName, email: `${pilotId}@x.test` },
    overall_status: overall,
    cells,
  };
}

describe("buildListEntries", () => {
  it("hides upcoming and not_started rows by default", () => {
    const items = [
      calendarItem({ id: "i-1", code: "ipc" }),
      calendarItem({ id: "i-2", code: "med" }),
    ];
    const rows = [
      row("p-1", "Alice", [
        cell("i-1", "upcoming"),
        cell("i-2", "not_started"),
      ]),
    ];
    expect(buildListEntries(items, rows, null)).toHaveLength(0);
  });

  it("sorts by status urgency, then grace_month_end, then pilot name", () => {
    const items = [
      calendarItem({ id: "i-1", code: "ipc" }),
      calendarItem({ id: "i-2", code: "med" }),
    ];
    const rows = [
      row("p-1", "Charlie", [
        cell("i-1", "grace_month", { grace_month_end: "2026-08-31" }),
      ]),
      row("p-2", "Alice", [
        cell("i-2", "non_current", { grace_month_end: "2026-04-30" }),
      ]),
      row("p-3", "Bob", [
        cell("i-1", "grace_month", { grace_month_end: "2026-07-31" }),
      ]),
    ];
    const out = buildListEntries(items, rows, null);
    expect(out.map((e) => e.pilot.full_name)).toEqual([
      "Alice", // non_current first
      "Bob",   // grace + earlier grace_month_end
      "Charlie",
    ]);
  });

  it("respects an explicit statusFilter (lets through normally-hidden statuses)", () => {
    const items = [calendarItem({ id: "i-1", code: "ipc" })];
    const rows = [
      row("p-1", "Alice", [cell("i-1", "upcoming")]),
    ];
    const out = buildListEntries(items, rows, "upcoming");
    expect(out).toHaveLength(1);
    expect(out[0].cell.status).toBe("upcoming");
  });
});

describe("ComplianceList", () => {
  it("renders the empty state when no entries pass the filter", () => {
    render(
      <ComplianceList
        items={[]}
        rows={[]}
        statusFilter={null}
      />,
    );
    expect(
      screen.getByText(/every pilot is fully current/i),
    ).toBeInTheDocument();
  });

  it("renders a table row per finding with pilot link + status pill", () => {
    const items = [
      calendarItem({
        id: "i-1",
        code: "med",
        name: "Medical Certificate",
        regulation: "14 CFR 61.23",
      }),
    ];
    const rows = [
      row("p-1", "Alice", [
        cell("i-1", "non_current", {
          last_completed_date: "2025-04-15",
          grace_month_end: "2026-04-30",
        }),
      ]),
    ];
    render(
      <ComplianceList items={items} rows={rows} statusFilter={null} />,
    );
    expect(screen.getByRole("link", { name: "Alice" })).toHaveAttribute(
      "href",
      "/compliance/pilots/p-1",
    );
    expect(screen.getByText("Medical Certificate")).toBeInTheDocument();
    expect(screen.getByText("14 CFR 61.23")).toBeInTheDocument();
    expect(screen.getByText("Non-Current")).toBeInTheDocument();
    expect(screen.getByText("2025-04-15")).toBeInTheDocument();
  });

  it("renders a rolling 'N/M' anchor cell for rolling-window items", () => {
    const items = [
      rollingItem({
        id: "r-1",
        code: "day_landing",
        name: "Day Landings",
      }),
    ];
    const rows = [
      row("p-1", "Alice", [
        cell("r-1", "due_this_month", { rolling_count: 1 }),
      ]),
    ];
    render(
      <ComplianceList items={items} rows={rows} statusFilter={null} />,
    );
    expect(screen.getByText(/1\/3 · 2 short/)).toBeInTheDocument();
  });
});
