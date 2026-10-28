import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DispatchOption } from "@/lib/api/ops";
import { onScreenNotices } from "@/lib/help/on-screen";

import { OptionCard } from "./option-card";

/**
 * One next-leg option.
 *
 * The distinction this file defends: a blocked option is shown and
 * explained but carries no rank. Legacy scored hard legal bars as
 * point deductions, so an aircraft that could not legally fly could
 * outrank one that could — which is what the rank badge must never
 * imply.
 */

function option(over: Partial<DispatchOption> = {}): DispatchOption {
  return {
    option_id: "f1:sched:0",
    kind: "continue_schedule",
    origin: "PABE",
    destination: "PAKI",
    proposed_etd: "2026-09-15T18:05:00Z",
    summary: "PABE-PAKI as DA101",
    reason: "DA101 departs PABE at 18:05Z with 6 booked",
    pax_count: 6,
    cargo_lbs: 0,
    source_flight_id: "sched-1",
    blockers: [],
    factors: [{ detail: "6 passengers booked", tone: "favourable" }],
    cost: {
      configured: false,
      fuel_cents: null,
      direct_cents: null,
      landing_fee_cents: null,
      total_cents: null,
      missing: ["no operating cost configured for caravan"],
    },
    rank: 1,
    ...over,
  };
}

describe("a dispatchable option", () => {
  it("leads with its rank", () => {
    render(<OptionCard option={option({ rank: 2 })} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
  });

  it("states its own reason rather than a score", () => {
    // Legacy shows 0–100 and a STRONG / CONSIDER label derived from
    // it. A dispatcher reading 84 cannot tell which of eleven inputs
    // produced it.
    render(<OptionCard option={option()} />);
    expect(
      screen.getByText("DA101 departs PABE at 18:05Z with 6 booked"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\b\d{1,3}\s*\/\s*100\b/)).not.toBeInTheDocument();
  });

  it("renders the load and the departure in UTC", () => {
    // Proposed departures are compared against a schedule, so the
    // viewer's zone would shift them.
    render(<OptionCard option={option({ cargo_lbs: 420 })} />);
    expect(screen.getByText("ETD 18:05Z")).toBeInTheDocument();
    expect(screen.getByText("6 pax")).toBeInTheDocument();
    expect(screen.getByText("420 lb cargo")).toBeInTheDocument();
  });

  it("marks a caution factor differently from a favourable one", () => {
    render(
      <OptionCard
        option={option({
          factors: [
            { detail: "6 passengers booked", tone: "favourable" },
            { detail: "No bookings on it yet", tone: "caution" },
          ],
        })}
      />,
    );
    expect(screen.getByText(/No bookings on it yet/).className).toMatch(
      /status-yellow/,
    );
    expect(screen.getByText(/6 passengers booked/).className).not.toMatch(
      /status-yellow/,
    );
  });
});

describe("a blocked option", () => {
  const blocked = option({
    rank: null,
    blockers: [
      {
        code: "grounded",
        detail: "Grounded since 2026-09-13 — prop strike inspection",
        source: "aircraft",
      },
    ],
  });

  it("carries no rank badge", () => {
    render(<OptionCard option={blocked} />);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("does not repeat an aircraft-level reason", () => {
    // The section header states it once in red. Repeating "Grounded
    // since…" under each of three options is noise, and the BLOCKED
    // badge already carries the fact.
    render(<OptionCard option={blocked} />);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(
      screen.queryByText(/prop strike inspection/),
    ).not.toBeInTheDocument();
  });

  it("does show a reason specific to this option", () => {
    render(
      <OptionCard
        option={option({
          rank: null,
          blockers: [
            {
              code: "crew_not_current",
              detail: "Assigned PIC is not current on type",
              source: "crew",
            },
          ],
        })}
      />,
    );
    expect(
      screen.getByText("Assigned PIC is not current on type"),
    ).toBeInTheDocument();
  });

  it("keeps the load visible", () => {
    // A dispatcher needs to know what is stuck, not just that
    // something is.
    render(<OptionCard option={blocked} />);
    expect(screen.getByText("6 pax")).toBeInTheDocument();
  });
});

describe("cost", () => {
  it("says the rates are unconfigured rather than showing a figure", () => {
    // Legacy falls back to a hardcoded $450/hr and prints the result
    // as money, so an operator who configured nothing still sees
    // confident dollars.
    render(<OptionCard option={option()} />);
    expect(screen.getByText(/rates not configured/)).toBeInTheDocument();
  });

  it("names what's missing and where it's set, on the card (#138)", () => {
    render(<OptionCard option={option()} />);
    expect(screen.getByText("no operating cost configured for caravan (Settings → Costs)")).toBeInTheDocument();
    expect(onScreenNotices()).toContain(
      "Setup needed: a dispatch option has no cost estimate: no operating cost configured for caravan (Settings → Costs).",
    );
  });

  it("shows the estimate once the rates exist", () => {
    render(
      <OptionCard
        option={option({
          cost: {
            configured: true,
            fuel_cents: 40000,
            direct_cents: 30000,
            landing_fee_cents: 5000,
            total_cents: 75000,
            missing: [],
          },
        })}
      />,
    );
    expect(screen.getByText(/est\. \$750/)).toBeInTheDocument();
  });

  it("says nothing about cost on a hold", () => {
    // Leaving an aircraft where it is costs nothing to fly, and
    // "rates not configured" against Hold reads as a fault.
    render(
      <OptionCard
        option={option({ kind: "hold", proposed_etd: null, pax_count: 0 })}
      />,
    );
    expect(screen.queryByText(/rates not configured/)).not.toBeInTheDocument();
  });
});

describe("a run for what is waiting (#76)", () => {
  const RUN = {
    pax_waiting: 5,
    pax_taken: 5,
    waiting_lbs: "2150.0",
    taken_lbs: "1100.0",
    fuel_lbs: "1005",
    flight_minutes: 55,
    back_at: "2026-09-15T21:20:00Z",
    missing: [],
  };
  const run = (over: Partial<DispatchOption> = {}) =>
    option({
      option_id: "f1:run:PAHP",
      kind: "waiting_run",
      destination: "PAHP",
      summary: "Run PABE-PAHP",
      reason:
        "Back in PABE at 18:00Z, it can take the 5 PAHP passengers and about 1,100 lb of the 2,150 lb of mail and freight waiting",
      pax_count: 5,
      cargo_lbs: 1100,
      source_flight_id: null,
      run: RUN,
      ...over,
    });

  it("says what it takes of what is waiting, and when it is back", () => {
    render(<OptionCard option={run()} />);
    expect(screen.getByText("Waiting load")).toBeInTheDocument();
    expect(screen.getByText("back 21:20Z")).toBeInTheDocument();
    expect(screen.getByText("5 pax")).toBeInTheDocument();
    expect(screen.getByText("1,100 of 2,150 lb mail & freight")).toBeInTheDocument();
    expect(screen.queryByText(/lb cargo/)).not.toBeInTheDocument();
  });

  it("says when not everyone fits", () => {
    render(<OptionCard option={run({ pax_count: 9, run: { ...RUN, pax_waiting: 12, pax_taken: 9 } })} />);
    expect(screen.getByText("9 of 12 pax")).toBeInTheDocument();
  });

  it("says when it can't be sized rather than guessing", () => {
    render(
      <OptionCard
        option={run({
          cargo_lbs: 0,
          run: { ...RUN, taken_lbs: null, fuel_lbs: null, back_at: null, missing: ["a route time for PABE-PAHP"] },
        })}
      />,
    );
    expect(screen.getByText("2,150 lb mail & freight waiting, not sized")).toBeInTheDocument();
    expect(screen.queryByText(/^back /)).not.toBeInTheDocument();
  });

  it("is blocked by the pilot's duty limit, which it names", () => {
    render(
      <OptionCard
        option={run({
          rank: null,
          blockers: [
            {
              code: "duty_limit",
              source: "crew",
              detail: "Alice Chen would be 16.3h into the duty day when back at PABE at 21:20Z (limit 14h)",
            },
          ],
        })}
      />,
    );
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByTestId("blocker-duty_limit")).toHaveTextContent("16.3h into the duty day");
  });
});
