import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MorningBrief } from "@/lib/api/ai";

import { BriefView } from "./brief-view";

/**
 * The morning brief page.
 *
 * The panels are mostly numbers in boxes; what earns tests here is
 * the handful of places a wrong render would mislead rather than
 * merely look off — the date, the alert banner, the empty states, and
 * the donut arithmetic.
 */

function brief(over: Partial<MorningBrief> = {}): MorningBrief {
  return {
    generated_for: "2026-09-04",
    flights: {
      total: 3,
      active: 3,
      segments: [
        { label: "Released", count: 2 },
        { label: "Planned", count: 1 },
        { label: "Completed", count: 0 },
        { label: "Cancelled", count: 0 },
      ],
    },
    fleet: {
      total: 8,
      segments: [
        { label: "Available", count: 1 },
        { label: "In Maintenance", count: 2 },
        { label: "Grounded", count: 5 },
      ],
    },
    load_factor: { percent: 85.2, pax: 23, seats: 27 },
    on_time: { percent: 0, completed: 0, total: 0, trend: null },
    revenue: { booked_cents: 0, bookings: 0 },
    crew: { total: 19, on_duty: 2, non_current: 0, grace: 1 },
    squawks: { open: 0, by_severity: {} },
    safety: { open: 0, by_severity: {} },
    maintenance_due: [],
    alerts: [],
    ...over,
  };
}

const view = (over: Partial<MorningBrief> = {}, operator = "Peregrine Demo") =>
  render(<BriefView brief={brief(over)} operator={operator} />);

describe("the date", () => {
  it("reads the ISO day without a timezone to get wrong", () => {
    // The API sends a bare YYYY-MM-DD. Handing that to `new Date()`
    // parses it as UTC midnight and then formats it in the host's
    // zone, which rolls it back a day anywhere west of Greenwich —
    // the brief would be headed "September 3" in Anchorage.
    view();
    expect(
      screen.getByText(/Friday, September 4, 2026 · Peregrine Demo/),
    ).toBeInTheDocument();
  });
});

describe("the alert banner", () => {
  it("shows each alert and marks it assertively", () => {
    view({
      alerts: [
        { text: "5 aircraft grounded: N200PA, N301PA, N402PA", severity: "critical" },
        { text: "1 pilot(s) in grace month: Dana Whitfield", severity: "warning" },
      ],
    });
    const banner = screen.getByRole("alert");
    expect(within(banner).getByText(/5 aircraft grounded/)).toBeInTheDocument();
    expect(within(banner).getByText(/in grace month/)).toBeInTheDocument();
  });

  it("colours critical apart from warning", () => {
    // Two alerts that read the same are worse than one — the whole
    // point of the banner is that the eye lands on the critical one.
    view({
      alerts: [
        { text: "5 aircraft grounded", severity: "critical" },
        { text: "1 pilot in grace month", severity: "warning" },
      ],
    });
    // Scoped to the banner: "grace" also appears as a crew row label.
    const banner = within(screen.getByRole("alert"));
    expect(banner.getByText(/aircraft grounded/).className).toMatch(
      /status-red/,
    );
    expect(banner.getByText(/grace month/).className).toMatch(/status-yellow/);
  });

  it("says so plainly when there is nothing wrong", () => {
    // An empty space where the alerts go reads as "not loaded", not
    // as "all clear".
    view();
    expect(
      screen.getByText("Nothing needs attention this morning."),
    ).toBeInTheDocument();
  });
});

describe("the donuts", () => {
  it("draws one arc per non-zero segment", () => {
    const { container } = view();
    const fleet = screen.getByRole("region", { name: "Fleet Status" });
    // Track plus three segments, all non-zero.
    expect(fleet.querySelectorAll("circle")).toHaveLength(4);
    expect(container).toBeTruthy();
  });

  it("omits zero segments rather than drawing a zero-length arc", () => {
    const flights = view().container;
    const card = within(
      screen.getByRole("region", { name: "Flights Today" }),
    );
    // Released and Planned are non-zero; Completed and Cancelled are
    // not, so two arcs plus the track.
    expect(
      screen
        .getByRole("region", { name: "Flights Today" })
        .querySelectorAll("circle"),
    ).toHaveLength(3);
    expect(card.getByText(/Released 2/)).toBeInTheDocument();
    expect(card.queryByText(/Cancelled/)).not.toBeInTheDocument();
    expect(flights).toBeTruthy();
  });

  it("still renders a ring on a day with nothing on it", () => {
    // An empty card has to read as a quiet day, not a broken panel.
    view({
      flights: {
        total: 0,
        active: 0,
        segments: [
          { label: "Released", count: 0 },
          { label: "Planned", count: 0 },
          { label: "Completed", count: 0 },
          { label: "Cancelled", count: 0 },
        ],
      },
    });
    const card = screen.getByRole("region", { name: "Flights Today" });
    expect(card.querySelectorAll("circle")).toHaveLength(1);
    expect(within(card).getByText("Nothing scheduled")).toBeInTheDocument();
  });
});

describe("on-time", () => {
  it("says there is no prior day instead of drawing an arrow", () => {
    // The service sends null rather than guessing. Legacy prints a
    // green up-arrow for 0% against 0% — an improvement that did not
    // happen.
    view();
    expect(screen.getByText("no prior day")).toBeInTheDocument();
  });

  it("draws the arrow when there is something to compare", () => {
    view({
      on_time: { percent: 75, completed: 3, total: 4, trend: "up" },
    });
    const card = screen.getByRole("region", { name: "On-Time (Yesterday)" });
    expect(within(card).getByText("75%")).toBeInTheDocument();
    expect(within(card).getByText("↑")).toBeInTheDocument();
    expect(within(card).getByText("3/4 flights on time")).toBeInTheDocument();
  });
});

describe("money", () => {
  it("renders cents as dollars", () => {
    // The API speaks cents. Printing them raw would report $1,234.00
    // of business as $123,400.
    view({ revenue: { booked_cents: 123_400, bookings: 2 } });
    expect(screen.getByText("$1,234")).toBeInTheDocument();
    expect(screen.getByText("2 bookings")).toBeInTheDocument();
  });

  it("does not pluralise a single booking", () => {
    view({ revenue: { booked_cents: 5000, bookings: 1 } });
    expect(screen.getByText("1 booking")).toBeInTheDocument();
  });
});

describe("counts", () => {
  it("reads All clear rather than an empty caption at zero", () => {
    view();
    expect(screen.getAllByText("All clear")).toHaveLength(2);
  });

  it("breaks a non-zero count down by severity", () => {
    view({ squawks: { open: 3, by_severity: { grounding: 2, minor: 1 } } });
    const card = screen.getByRole("region", { name: "Open Squawks" });
    expect(within(card).getByText("3")).toBeInTheDocument();
    expect(within(card).getByText("2 grounding · 1 minor")).toBeInTheDocument();
  });
});

describe("maintenance due", () => {
  it("says nothing is due rather than showing an empty table", () => {
    view();
    expect(screen.getByText("No items due this week")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("counts the items in its own heading", () => {
    view({
      maintenance_due: [
        { tail: "N100PA", item: "100-hour", due: "2000 hrs", overdue: false },
      ],
    });
    expect(
      screen.getByText("Maintenance Due This Week (1)"),
    ).toBeInTheDocument();
  });

  it("marks an overdue item apart from a due one", () => {
    view({
      maintenance_due: [
        { tail: "N301PA", item: "Annual", due: "2026-08-01", overdue: true },
        { tail: "N100PA", item: "100-hour", due: "2000 hrs", overdue: false },
      ],
    });
    // By row, because "Due" is also a column header.
    const rows = screen.getAllByRole("row").slice(1);
    const overdueRow = rows.find((r) => within(r).queryByText("N301PA"))!;
    const dueRow = rows.find((r) => within(r).queryByText("N100PA"))!;
    expect(within(overdueRow).getByText("Overdue").className).toMatch(
      /status-red/,
    );
    expect(within(dueRow).getByText("Due").className).not.toMatch(/status-red/);
  });
});

describe("crew", () => {
  it("shows each measure against the roster size", () => {
    view({ crew: { total: 19, on_duty: 2, non_current: 3, grace: 1 } });
    const card = screen.getByRole("region", { name: "Crew Status" });
    expect(within(card).getByText("19 on the roster")).toBeInTheDocument();
    expect(within(card).getByText("On duty")).toBeInTheDocument();
    expect(within(card).getByText("Not current")).toBeInTheDocument();
  });

  it("does not divide by zero on an empty roster", () => {
    view({ crew: { total: 0, on_duty: 0, non_current: 0, grace: 0 } });
    expect(screen.getByText("0 on the roster")).toBeInTheDocument();
  });
});
