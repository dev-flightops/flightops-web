import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SeasonalMonth } from "@/lib/api/reports";

import { SeasonalBars } from "./seasonal-bars";

/**
 * Twelve months of demand.
 *
 * The cases worth pinning: an empty month still appears, because a gap
 * in a seasonal series is the information; and a month where nobody
 * filed a manifest reports no load factor rather than 0%, which is the
 * distinction the whole BI report rests on.
 */

function month(over: Partial<SeasonalMonth> = {}): SeasonalMonth {
  return {
    year: 2026,
    month: 7,
    label: "Jul 2026",
    flights: 10,
    flights_with_manifest: 8,
    pax: 40,
    revenue_cents: 250000,
    load_factor_pct: 62.5,
    ...over,
  };
}

/** A full window, mostly quiet, with one busy month. */
function twelve(): SeasonalMonth[] {
  const out: SeasonalMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const m = ((2 + i) % 12) + 1;
    out.push(
      month({
        year: 2026,
        month: m,
        label: `M${m} 2026`,
        flights: 0,
        flights_with_manifest: 0,
        pax: 0,
        revenue_cents: 0,
        load_factor_pct: null,
      }),
    );
  }
  out[4] = month({ year: 2026, month: 7, label: "Jul 2026" });
  return out;
}

describe("the window", () => {
  it("renders every month, including the empty ones", () => {
    // A gap in a seasonal series is the information. Dropping the
    // quiet months makes twelve months look like one.
    render(<SeasonalBars months={twelve()} />);
    expect(
      screen.getAllByTestId(/^month-2026-/).length,
    ).toBe(12);
  });

  it("only tables the months that flew", () => {
    // The bars carry the shape; a table row per empty month is eleven
    // rows of zeroes.
    render(<SeasonalBars months={twelve()} />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("Jul 2026")).toBeInTheDocument();
  });

  it("says so when nothing flew at all", () => {
    const empty = twelve().map((m) =>
      month({ ...m, flights: 0, load_factor_pct: null }),
    );
    render(<SeasonalBars months={empty} />);
    expect(screen.getByText(/No flights in the last 12 months/)).toBeInTheDocument();
  });
});

describe("a month's figures", () => {
  it("shows flights, pax and revenue", () => {
    render(<SeasonalBars months={[month()]} />);
    const row = screen.getAllByRole("row")[1];
    expect(within(row).getByText("10")).toBeInTheDocument();
    expect(within(row).getByText("40")).toBeInTheDocument();
    expect(within(row).getByText("$2,500")).toBeInTheDocument();
  });

  it("carries the denominator beside the load factor", () => {
    // 62.5% over 8 of 10 flights is a different claim from 62.5% over
    // all of them, and the reader cannot tell without this.
    render(<SeasonalBars months={[month()]} />);
    expect(screen.getByText("62.5%")).toBeInTheDocument();
    expect(screen.getByText("(8 of 10)")).toBeInTheDocument();
  });

  it("reports no load factor when no manifest was filed", () => {
    // Not 0%. The month flew ten times and filed nothing, so the
    // aircraft's fullness is unknown rather than zero.
    render(
      <SeasonalBars
        months={[
          month({ flights_with_manifest: 0, pax: 0, load_factor_pct: null }),
        ]}
      />,
    );
    const row = screen.getAllByRole("row")[1];
    expect(within(row).getByText("—")).toBeInTheDocument();
    expect(within(row).queryByText("0.0%")).not.toBeInTheDocument();
  });

  it("explains the dash rather than leaving it bare", () => {
    render(
      <SeasonalBars
        months={[month({ flights_with_manifest: 0, load_factor_pct: null })]}
      />,
    );
    expect(screen.getByText("—")).toHaveAttribute(
      "title",
      expect.stringContaining("No manifest filed"),
    );
  });
});

describe("the bars", () => {
  it("gives a month that flew once a visible bar", () => {
    // Otherwise one flight against a busy month rounds to nothing and
    // the month reads as empty.
    const months = twelve();
    months[0] = month({
      year: 2026,
      month: 3,
      label: "M3 2026",
      flights: 1,
      flights_with_manifest: 0,
      pax: 0,
      load_factor_pct: null,
    });
    render(<SeasonalBars months={months} />);
    const bar = screen
      .getByTestId("month-2026-3")
      .querySelector("div") as HTMLElement;
    expect(parseFloat(bar.style.height)).toBeGreaterThan(0);
  });

  it("gives an empty month no bar", () => {
    render(<SeasonalBars months={twelve()} />);
    const bar = screen
      .getByTestId("month-2026-4")
      .querySelector("div") as HTMLElement;
    expect(bar.style.height).toBe("0%");
  });

  it("describes each month on hover, including the empty ones", () => {
    render(<SeasonalBars months={twelve()} />);
    expect(screen.getByTestId("month-2026-4")).toHaveAttribute(
      "title",
      expect.stringContaining("no flights"),
    );
    expect(screen.getByTestId("month-2026-7")).toHaveAttribute(
      "title",
      expect.stringContaining("10 flights"),
    );
  });
});
