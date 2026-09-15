import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProfitRow } from "@/lib/api/reports";

import { ProfitTable } from "./profit-table";

/**
 * One profitability breakdown.
 *
 * Legacy's equivalents are headed "Cost by Route" and "Cost by
 * Aircraft" and carry no revenue, no profit and no margin. The tests
 * here are mostly about the two things that replaced that: a margin
 * that can be absent, and a row that admits its own gaps.
 */

function row(over: Partial<ProfitRow> = {}): ProfitRow {
  return {
    label: "PANC-PAKI",
    flights: 4,
    completed: 4,
    block_hours: 8,
    revenue_cents: 120000,
    cost_cents: 45000,
    profit_cents: 75000,
    margin_pct: 62.5,
    unpriced: 0,
    without_hours: 0,
    ...over,
  };
}

function table(rows: ProfitRow[]) {
  render(
    <ProfitTable caption="test" firstColumn="Route" rows={rows} />,
  );
}

describe("the columns legacy does not have", () => {
  it("shows revenue, profit and margin", () => {
    table([row()]);
    const r = screen.getByTestId("row-PANC-PAKI");
    expect(within(r).getByText("$1,200")).toBeInTheDocument();
    expect(within(r).getByText("$750")).toBeInTheDocument();
    expect(within(r).getByText("62.5%")).toBeInTheDocument();
  });

  it("names the first column for the breakdown it is", () => {
    render(<ProfitTable caption="t" firstColumn="Aircraft" rows={[row()]} />);
    expect(
      screen.getByRole("columnheader", { name: "Aircraft" }),
    ).toBeInTheDocument();
  });
});

describe("a loss", () => {
  it("colours a negative profit", () => {
    table([row({ revenue_cents: 10000, cost_cents: 45000, profit_cents: -35000, margin_pct: -350 })]);
    const r = screen.getByTestId("row-PANC-PAKI");
    expect(within(r).getByText("-$350").className).toMatch(/status-red/);
  });

  it("colours a negative margin", () => {
    table([row({ profit_cents: -35000, margin_pct: -29.2 })]);
    expect(screen.getByText("-29.2%").className).toMatch(/status-red/);
  });
});

describe("a margin that does not exist", () => {
  it("renders a dash, not zero percent", () => {
    // Zero revenue against real cost is a loss, not a 0% margin.
    table([row({ revenue_cents: 0, margin_pct: null })]);
    const r = screen.getByTestId("row-PANC-PAKI");
    expect(within(r).getByText("—")).toBeInTheDocument();
    expect(within(r).queryByText("0.0%")).not.toBeInTheDocument();
  });

  it("explains the dash on hover rather than leaving it bare", () => {
    table([row({ revenue_cents: 0, margin_pct: null })]);
    expect(screen.getByText("—")).toHaveAttribute(
      "title",
      expect.stringContaining("no margin"),
    );
  });
});

describe("a row that admits its own gaps", () => {
  it("says how many legs could not be costed", () => {
    // Without this a route showing $0 cost looks free rather than
    // uncosted — which is the reading legacy's page invites, since it
    // substitutes constants and says nothing.
    table([row({ unpriced: 2, cost_cents: 0 })]);
    expect(screen.getByText(/2 uncosted/)).toBeInTheDocument();
  });

  it("says how many legs could not be timed", () => {
    table([row({ without_hours: 1 })]);
    expect(screen.getByText(/1 untimed/)).toBeInTheDocument();
  });

  it("says both when both apply", () => {
    table([row({ unpriced: 2, without_hours: 1 })]);
    expect(screen.getByText(/2 uncosted, 1 untimed/)).toBeInTheDocument();
  });

  it("says nothing when the row is complete", () => {
    // Or the warning becomes decoration on every row and stops being
    // read.
    table([row()]);
    expect(screen.queryByText(/uncosted|untimed/)).not.toBeInTheDocument();
  });
});

describe("the empty case", () => {
  it("says there are no flights rather than rendering an empty table", () => {
    table([]);
    expect(screen.getByText(/No flights on file/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("layout", () => {
  it("keeps a wide table inside its own scroller", () => {
    // Seven columns must not push the page sideways.
    const { container } = render(
      <ProfitTable caption="t" firstColumn="Route" rows={[row()]} />,
    );
    expect(
      container.querySelector("table")?.closest("div")?.className,
    ).toMatch(/overflow-x-auto/);
  });
});
