import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExecutiveSummary } from "@/lib/api/reports";

import { SummaryView } from "./summary-view";

/**
 * The executive summary page.
 *
 * What earns tests here is the places a plausible render would state
 * something untrue: a change of "+0%" where there was nothing to
 * compare against, a margin shown without the caveat that nothing was
 * costed, and cents printed as dollars.
 */

function summary(over: Partial<ExecutiveSummary> = {}): ExecutiveSummary {
  return {
    period_start: "2026-09-01",
    period_end: "2026-09-07",
    prior_period_start: "2026-08-01",
    prior_period_end: "2026-08-07",
    revenue: { cents: 100_000, comparison: { prior_cents: 50_000, change_pct: 100 } },
    cost: { cents: 20_000, comparison: { prior_cents: 25_000, change_pct: -20 } },
    profit_cents: 80_000,
    margin_pct: 80,
    flights: 4,
    flights_change_pct: 300,
    pax: 12,
    pax_change_pct: null,
    block_hours: 5.12,
    revenue_per_hour_cents: 19_531,
    cost_per_hour_cents: 3_906,
    fleet_total: 8,
    fleet_grounded: 4,
    crew_total: 19,
    open_squawks: 4,
    basis: {
      flights_priced: 4,
      flights_unpriced: 0,
      flights_without_duration: 0,
      cost_factors_on_file: 2,
      fuel_prices_on_file: 7,
    },
    ...over,
  };
}

const view = (over: Partial<ExecutiveSummary> = {}) =>
  render(<SummaryView summary={summary(over)} />);

describe("money", () => {
  it("prints cents as dollars", () => {
    // The API speaks cents throughout. Printing them raw reports
    // $1,000 of revenue as $100,000.
    view();
    const band = within(
      screen.getByRole("region", { name: "Revenue & Profitability" }),
    );
    expect(band.getByText("$1,000")).toBeInTheDocument();
    expect(band.getByText("$200")).toBeInTheDocument();
    expect(band.getByText("$800")).toBeInTheDocument();
  });

  it("shows a loss as a loss", () => {
    view({ profit_cents: -50_000, margin_pct: -50 });
    const band = within(
      screen.getByRole("region", { name: "Revenue & Profitability" }),
    );
    expect(band.getByText("-$500").className).toMatch(/status-red/);
  });
});

describe("change against the prior period", () => {
  it("labels a real change with its direction", () => {
    view();
    expect(screen.getByText("+100% vs prior month")).toBeInTheDocument();
  });

  it("says there was nothing to compare rather than showing 0%", () => {
    // Legacy renders "+0%" here, which reads as flat beside a number
    // that went from nothing to something.
    view({
      revenue: { cents: 100_000, comparison: { prior_cents: 0, change_pct: null } },
    });
    const band = within(
      screen.getByRole("region", { name: "Revenue & Profitability" }),
    );
    expect(band.getByText("no prior month to compare")).toBeInTheDocument();
    expect(screen.queryByText("+0% vs prior month")).not.toBeInTheDocument();
  });

  it("puts an em dash in the table, not a percentage", () => {
    view({ pax_change_pct: null });
    const row = screen
      .getAllByRole("row")
      .find((r) => within(r).queryByText("Passengers"))!;
    // Last cell is the change column.
    const cells = within(row).getAllByRole("cell");
    expect(cells[cells.length - 1]).toHaveTextContent("—");
  });

  it("treats rising cost as the bad direction", () => {
    // Revenue up is green; cost up is not. Colouring both the same
    // way would make a worsening month look like a good one.
    view({
      cost: { cents: 30_000, comparison: { prior_cents: 10_000, change_pct: 200 } },
    });
    expect(screen.getByText("+200% vs prior month").className).toMatch(
      /status-red/,
    );
  });
});

describe("the cost-basis notice", () => {
  it("stays hidden when everything was priced", () => {
    view();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says so when no cost factors are configured at all", () => {
    // The case on the demo tenant today. Without this the page reports
    // a 100% margin and looks like good news.
    view({
      cost: { cents: 0, comparison: { prior_cents: 0, change_pct: null } },
      basis: {
        flights_priced: 0,
        flights_unpriced: 4,
        flights_without_duration: 0,
        cost_factors_on_file: 0,
        fuel_prices_on_file: 7,
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "No operating-cost factors are on file",
    );
  });

  it("counts the flights it could not price when some factors exist", () => {
    view({
      basis: {
        flights_priced: 3,
        flights_unpriced: 1,
        flights_without_duration: 0,
        cost_factors_on_file: 2,
        fuel_prices_on_file: 7,
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 of 4 flights could not be costed",
    );
  });
});

describe("margin", () => {
  it("says there is no revenue to margin rather than showing 0%", () => {
    view({
      revenue: { cents: 0, comparison: { prior_cents: 0, change_pct: null } },
      profit_cents: 0,
      margin_pct: null,
    });
    expect(screen.getByText("no revenue to margin")).toBeInTheDocument();
  });
});

describe("unit economics", () => {
  it("dashes a per-hour figure when nothing flew", () => {
    view({
      block_hours: 0,
      revenue_per_hour_cents: null,
      cost_per_hour_cents: null,
    });
    const band = within(screen.getByRole("region", { name: "Unit Economics" }));
    expect(band.getAllByText("—")).toHaveLength(2);
    expect(band.getAllByText("no hours flown")).toHaveLength(2);
  });

  it("labels the hours as block hours, since that is what they are", () => {
    view();
    expect(screen.getByText("5.1 hrs")).toBeInTheDocument();
    expect(screen.getByText("Block Hours MTD")).toBeInTheDocument();
  });
});

describe("operations", () => {
  it("shows fleet availability as a fraction of the whole fleet", () => {
    view();
    expect(screen.getByText("4/8")).toBeInTheDocument();
    expect(screen.getByText("4 grounded").className).toMatch(/status-red/);
  });

  it("says none grounded rather than leaving the note blank", () => {
    view({ fleet_grounded: 0 });
    expect(screen.getByText("none grounded")).toBeInTheDocument();
  });
});

describe("the period", () => {
  it("reads the ISO days without a timezone to get wrong", () => {
    // A bare YYYY-MM-DD through new Date() lands at UTC midnight and
    // renders a day early west of Greenwich.
    view();
    expect(
      screen.getByText(/Sep 01 — Sep 07, 2026 — 60-second snapshot/),
    ).toBeInTheDocument();
  });

  it("states that the comparison is like-for-like", () => {
    // Legacy compares a partial month against a whole one. Saying
    // which span is being compared is what stops a reader assuming
    // the wrong thing.
    view();
    expect(
      screen.getByText(/the same span of the prior month, not the whole of it/),
    ).toBeInTheDocument();
  });
});
