import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExternalPlan, FlightPlans, ToolPlan } from "@/lib/api/integrations";

import { ForeFlightPlans, ForeFlightPlansWaitingBanner } from "./foreflight-plans";

/** The pilot's plan from ForeFlight beside Peregrine's check (#55). */

const PLAN: ToolPlan = {
  source: "foreflight",
  tail: "N100PA",
  departure: "PANC",
  destination: "PABE",
  alternates: ["PAEN"],
  route: "ANC J501 BET",
  flight_rule: "IFR",
  departs_at: "2026-10-08T14:00:00+00:00",
  arrives_at: "2026-10-08T15:25:00+00:00",
  ete_minutes: 85,
  fuel: { unit: "lb", total: 1200, to_destination: 400, reserve: 300, alternate: null, landing: 800 },
  weight_unit: "lb",
  weights: [
    { point: "Takeoff", weight: 8000, max: 8785 },
    { point: "Landing", weight: 7600, max: 8500 },
  ],
  cg_unit: "in",
  cg: [{ point: "Takeoff", cg: 186.25, fwd: 180, aft: 190 }],
  within_limits: true,
  limit_issues: [],
  released: false,
  filing_status: "Filed",
  crew: [{ position: "PIC", id: "sarah@peregrine.local" }],
  warnings: ["Icing forecast on route"],
};

const SENT: ExternalPlan = {
  id: "11111111-1111-4111-8111-111111111111",
  provider: "foreflight",
  leg_sequence: 1,
  match: "linked",
  plan: { ...PLAN, account: "Demo Air Ops" },
  fetched_at: "2026-10-07T10:05:00Z",
};

const OWN: ExternalPlan = {
  id: "22222222-2222-4222-8222-222222222222",
  provider: "foreflight",
  leg_sequence: 2,
  match: "matched",
  plan: {
    ...PLAN,
    departure: "PABE",
    destination: "PANC",
    weights: [{ point: "Takeoff", weight: 8900, max: 8785 }],
    cg: [],
    within_limits: false,
    limit_issues: ["Takeoff weight 8,900 lb is over the maximum 8,785"],
    warnings: [],
    filing_status: "None",
  },
  fetched_at: "2026-10-07T10:05:00Z",
};

function data(overrides: Partial<FlightPlans> = {}): FlightPlans {
  return {
    flight_id: "f-1",
    our_weight_and_balance: null,
    plans: [SENT],
    disagreements: [],
    bringing_plans: true,
    ...overrides,
  };
}

describe("ForeFlightPlans (#55)", () => {
  it("shows the plan, ForeFlight's weight and balance, and fresh document links", () => {
    render(<ForeFlightPlans data={data()} />);
    expect(screen.getByText("ForeFlight plan")).toBeTruthy();
    expect(screen.getByText("Not checked yet: the PIC confirms it at preflight step 2.")).toBeTruthy();
    const plan = within(screen.getByRole("article", { name: "ForeFlight plan: Leg 1 · PANC → PABE · N100PA" }));
    expect(plan.getByText("Sent from Peregrine")).toBeTruthy();
    expect(plan.getByText("2026-10-08 14:00Z")).toBeTruthy();
    expect(plan.getByText("1h 25m")).toBeTruthy();
    expect(plan.getByText("ANC J501 BET")).toBeTruthy();
    expect(plan.getByText("total 1,200 · to destination 400 · reserve 300 · landing 800")).toBeTruthy();
    expect(plan.getByText("8,000 lb")).toBeTruthy();
    expect(plan.getByText("max 8,785")).toBeTruthy();
    expect(plan.getByText("186.25 in")).toBeTruthy();
    expect(plan.getByText("180 to 190")).toBeTruthy();
    expect(plan.getByText("Within every limit ForeFlight has.")).toBeTruthy();
    expect(plan.getByText("Filing: Filed")).toBeTruthy();
    expect(plan.getByText("Icing forecast on route")).toBeTruthy();
    expect(plan.getByRole("link", { name: "Navlog" }).getAttribute("href")).toBe(
      `/api/foreflight/plans/${SENT.id}/documents/navlog`,
    );
    expect(plan.getByRole("link", { name: "W&B report" }).getAttribute("href")).toBe(
      `/api/foreflight/plans/${SENT.id}/documents/wb`,
    );
    expect(plan.getByText("Fetched 2026-10-07 10:05Z from Demo Air Ops")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("flags a plan whose weight and balance says the opposite of ours", () => {
    render(
      <ForeFlightPlans
        data={data({ our_weight_and_balance: "within", plans: [SENT, OWN], disagreements: [OWN.id] })}
      />,
    );
    expect(screen.getByText("ForeFlight plans")).toBeTruthy();
    expect(screen.getByText("Within limits: the PIC confirmed it at preflight.")).toBeTruthy();
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    const own = screen.getByRole("article", { name: "ForeFlight plan: Leg 2 · PABE → PANC · N100PA" });
    expect(own.contains(alerts[0])).toBe(true);
    expect(alerts[0].textContent).toMatch(/Peregrine’s check is the\s+record/);
    expect(within(own).getByText("Matched by tail and time")).toBeTruthy();
    expect(within(own).getByText("Takeoff weight 8,900 lb is over the maximum 8,785")).toBeTruthy();
    // "None" from ForeFlight isn't worth a line.
    expect(within(own).queryByText(/Filing:/)).toBeNull();
  });

  it("says when ForeFlight has no weight and balance yet", () => {
    const bare: ExternalPlan = {
      ...SENT,
      plan: { ...PLAN, weights: [], cg: [], within_limits: null, warnings: [] },
    };
    render(<ForeFlightPlans data={data({ plans: [bare] })} />);
    expect(screen.getByText("ForeFlight has no weight and balance for this leg yet.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("says a flight has no plan yet only for a company that brings plans back", () => {
    const { container, rerender } = render(<ForeFlightPlans data={data({ plans: [], bringing_plans: false })} />);
    expect(container.textContent).toBe("");
    rerender(<ForeFlightPlans data={data({ plans: [] })} />);
    expect(screen.getByText(/No plan from ForeFlight for this flight yet/)).toBeTruthy();
  });
});

describe("ForeFlightPlansWaitingBanner (#55)", () => {
  it("points dispatch at the queue while plans wait, and is gone when none do", () => {
    const { container, rerender } = render(<ForeFlightPlansWaitingBanner count={0} />);
    expect(container.textContent).toBe("");
    rerender(<ForeFlightPlansWaitingBanner count={2} />);
    expect(screen.getByText("2 plans pilots made in ForeFlight fit no single leg here.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Place them" }).getAttribute("href")).toBe("/dispatch/foreflight-plans");
    rerender(<ForeFlightPlansWaitingBanner count={1} />);
    expect(screen.getByText("1 plan pilots made in ForeFlight fits no single leg here.")).toBeTruthy();
  });
});
