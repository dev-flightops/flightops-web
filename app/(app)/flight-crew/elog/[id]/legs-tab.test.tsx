import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// LegCard is a client component that dispatches server actions on
// blur/click; we just need it to render in JSDOM without throwing.
// The Next router hook is also touched (for `router.refresh`).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./legs-actions", () => ({
  addLegAction: vi.fn(),
  updateLegAction: vi.fn(),
  deleteLegAction: vi.fn(),
}));

import { LegsTab } from "./legs-tab";
import type { FlightLogLeg } from "@/lib/api/types";

function makeLeg(over: Partial<FlightLogLeg> & { id: string }): FlightLogLeg {
  return {
    flight_log_id: "log-1",
    leg_number: 1,
    origin_icao: "PANC",
    dest_icao: "PADU",
    engine_on: "15:00:00",
    blocks_off: "15:10:00",
    blocks_on: "16:50:00",
    engine_off: "17:00:00",
    crosses_midnight: false,
    start_hobbs: 2050.5,
    end_hobbs: 2052.2,
    landings: 1,
    night_landings: 0,
    pilot_flying: "pic",
    routing: "PANC..ENA..PADU",
    basic_empty_weight_lbs: null,
    pilot_weight_lbs: null,
    sic_weight_lbs: null,
    pax_weight_lbs: null,
    baggage_weight_lbs: null,
    cargo_weight_lbs: null,
    fuel_gallons: null,
    fuel_weight_lbs: null,
    ...over,
  };
}

describe("LegsTab", () => {
  it("renders an Add Leg button + empty hint when no legs exist", () => {
    render(
      <LegsTab logId="log-1" logStatus="draft" initialLegs={[]} />,
    );

    expect(screen.getByText(/no legs yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /\+ add leg/i }),
    ).toBeInTheDocument();
  });

  it("renders one card per leg with header + computed totals", () => {
    render(
      <LegsTab
        logId="log-1"
        logStatus="draft"
        initialLegs={[
          makeLeg({ id: "l-1" }),
          makeLeg({
            id: "l-2",
            leg_number: 2,
            origin_icao: "PADU",
            dest_icao: "PAGM",
          }),
        ]}
      />,
    );

    expect(screen.getByText(/^Leg 1$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Leg 2$/i)).toBeInTheDocument();
    // Flight time = blocks_on - blocks_off = 16:50 - 15:10 = 1h 40m = 1.7h
    expect(screen.getAllByText(/1\.7/i).length).toBeGreaterThan(0);
    // Block time = 17:00 - 15:00 = 2.0h
    expect(screen.getAllByText(/2\.0/i).length).toBeGreaterThan(0);
    // Hobbs delta = 2052.2 - 2050.5 = 1.7h (note: same numeric as flight)
  });

  it("hides Add Leg + Delete in read-only (submitted) mode", () => {
    render(
      <LegsTab
        logId="log-1"
        logStatus="submitted"
        initialLegs={[makeLeg({ id: "l-1" })]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /\+ add leg/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^delete$/i }),
    ).not.toBeInTheDocument();
  });

  it("disables inputs in read-only mode", () => {
    render(
      <LegsTab
        logId="log-1"
        logStatus="submitted"
        initialLegs={[makeLeg({ id: "l-1" })]}
      />,
    );

    // Pick a representative input — the routing free-text — and
    // confirm it's disabled. The disabled prop propagates to every
    // field through the same `readOnly` flag.
    const routing = screen.getByLabelText(/routing/i) as HTMLInputElement;
    expect(routing).toBeDisabled();
  });

  it("renders the read-only empty state when a submitted log has no legs", () => {
    render(
      <LegsTab logId="log-1" logStatus="submitted" initialLegs={[]} />,
    );

    expect(
      screen.getByText(/no legs on this submitted log/i),
    ).toBeInTheDocument();
  });

  it("leg cards expose the leg number in the heading", () => {
    render(
      <LegsTab
        logId="log-1"
        logStatus="draft"
        initialLegs={[
          makeLeg({ id: "l-1", leg_number: 7 }),
        ]}
      />,
    );

    expect(screen.getByText(/^Leg 7$/i)).toBeInTheDocument();
  });

  it("crosses-midnight checkbox adds 24h to flight time when set", () => {
    // Without crosses_midnight + blocks_off later than blocks_on:
    //   blocks_off = 22:00, blocks_on = 02:00 → would compute as 0h
    //   (negative → clamped to 0).
    // With crosses_midnight=true → 4h.
    render(
      <LegsTab
        logId="log-1"
        logStatus="draft"
        initialLegs={[
          makeLeg({
            id: "l-1",
            blocks_off: "22:00:00",
            blocks_on: "02:00:00",
            engine_on: null,
            engine_off: null,
            crosses_midnight: true,
          }),
        ]}
      />,
    );

    const card = screen.getByText(/^Leg 1$/i).closest("div")!;
    expect(within(card.parentElement!).getByText(/4\.0/)).toBeInTheDocument();
  });
});
