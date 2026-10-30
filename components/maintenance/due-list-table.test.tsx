import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DueItem } from "@/lib/api/maintenance";

vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {}, apiFetch: vi.fn() }));
vi.mock("./due-item-dialogs", () => ({
  SignOffDueItemDialog: ({ item }: { item: DueItem }) => <button>Sign off {item.title}</button>,
  RetireDueItemButton: () => <button>Retire</button>,
}));

import { DueListTable } from "./due-list-table";

function item(over: Partial<DueItem>): DueItem {
  return {
    id: "i-1",
    aircraft_id: "a-1",
    tail_number: "N100PA",
    kind: "inspection",
    title: "100-hour inspection",
    reference: null,
    interval_hours: 100,
    interval_days: null,
    due_hours: 3240,
    due_on: null,
    last_done_on: "2026-07-02",
    last_done_hours: 3140,
    grounds_when_overdue: true,
    is_active: true,
    notes: null,
    state: "overdue",
    hours_left: -7.5,
    days_left: null,
    summary: "100-hour inspection: 7.5 hours overdue",
    aircraft_total_hours: 3247.5,
    ...over,
  };
}

describe("DueListTable (#156)", () => {
  it("says an overdue item grounds the aircraft, and by how much", () => {
    render(<DueListTable items={[item({})]} showAircraft />);
    const row = screen.getByRole("row", { name: /100-hour inspection/ });
    expect(within(row).getByText("N100PA")).toHaveAttribute("href", "/maintenance/aircraft/a-1");
    expect(within(row).getByText("7.5 h over")).toBeInTheDocument();
    expect(within(row).getByText("Overdue")).toBeInTheDocument();
    expect(within(row).getByText("Grounds the aircraft")).toBeInTheDocument();
    expect(within(row).getByText(/every 100\.0 h/)).toBeInTheDocument();
  });

  it("shows a date item's days, and a coming one as due soon", () => {
    render(
      <DueListTable
        items={[
          item({
            id: "i-2",
            kind: "calendar",
            title: "ELT battery",
            interval_hours: null,
            interval_days: 730,
            due_hours: null,
            due_on: "2026-11-12",
            state: "due_soon",
            hours_left: null,
            days_left: 13,
          }),
        ]}
      />,
    );
    const row = screen.getByRole("row", { name: /ELT battery/ });
    expect(within(row).getByText("13 d left")).toBeInTheDocument();
    expect(within(row).getByText("Due soon")).toBeInTheDocument();
    expect(within(row).getByText(/every 2 yr/)).toBeInTheDocument();
    expect(within(row).queryByText("Grounds the aircraft")).toBeNull();
  });

  it("offers sign-off and retiring to maintenance only", () => {
    const { rerender } = render(<DueListTable items={[item({})]} />);
    expect(screen.queryByText(/Sign off/)).toBeNull();
    rerender(<DueListTable items={[item({})]} canSignOff />);
    expect(screen.getByText("Sign off 100-hour inspection")).toBeInTheDocument();
    expect(screen.getByText("Retire")).toBeInTheDocument();
  });

  it("says when the list is empty", () => {
    render(<DueListTable items={[]} emptyMessage="Nothing due." />);
    expect(screen.getByText("Nothing due.")).toBeInTheDocument();
  });
});
