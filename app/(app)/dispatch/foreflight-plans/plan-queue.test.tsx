import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  assignPlanAction: vi.fn(),
  ignorePlanAction: vi.fn(),
}));
vi.mock("./actions", () => actions);

import type { QueuedPlan, ToolPlan } from "@/lib/api/integrations";

import { PlanQueue } from "./plan-queue";

/** ForeFlight plans no single leg fits, for dispatch to place (#55). */

const PLAN: ToolPlan = {
  source: "foreflight",
  tail: "N100PA",
  departure: "PANC",
  destination: "PABE",
  alternates: [],
  route: null,
  flight_rule: null,
  departs_at: "2026-10-08T16:30:00+00:00",
  arrives_at: null,
  ete_minutes: null,
  fuel: { unit: null, total: null, to_destination: null, reserve: null, alternate: null, landing: null },
  weight_unit: "lb",
  weights: [],
  cg: [],
  cg_unit: "",
  within_limits: null,
  limit_issues: [],
  released: false,
  filing_status: null,
  crew: [{ position: "PIC", id: "sarah@peregrine.local" }],
  warnings: [],
};

const TORN: QueuedPlan = {
  id: "33333333-3333-4333-8333-333333333333",
  provider: "foreflight",
  leg_sequence: null,
  match: "ambiguous",
  plan: PLAN,
  fetched_at: "2026-10-07T10:05:00Z",
  candidates: [
    {
      flight_id: "f-900",
      flight_number: "PGR900",
      leg_sequence: 1,
      origin: "PANC",
      destination: "PABE",
      departs_at: "2026-10-08T14:00:00Z",
    },
    {
      flight_id: "f-901",
      flight_number: "PGR901",
      leg_sequence: 1,
      origin: "PANC",
      destination: "PABE",
      departs_at: "2026-10-08T19:00:00Z",
    },
  ],
};

const STRAY: QueuedPlan = {
  ...TORN,
  id: "44444444-4444-4444-8444-444444444444",
  match: "unmatched",
  plan: { ...PLAN, tail: "N999ZZ", crew: [] },
  candidates: [],
};

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset();
});

describe("PlanQueue (#55)", () => {
  it("puts a plan on the leg a dispatcher chooses", async () => {
    actions.assignPlanAction.mockResolvedValue({ ok: true });
    render(<PlanQueue plans={[TORN, STRAY]} />);
    const rows = within(screen.getByRole("list", { name: "ForeFlight plans waiting" })).getAllByRole("listitem");
    const torn = within(rows[0]);
    expect(torn.getByText("PANC → PABE · N100PA")).toBeTruthy();
    expect(
      torn.getByText(
        "More than one leg has its tail and airports near its time. · No weight and balance yet · Crew sarah@peregrine.local",
      ),
    ).toBeTruthy();
    const put = torn.getByRole("button", { name: "Put it on this leg" }) as HTMLButtonElement;
    // Nothing is chosen for the dispatcher.
    expect(put.disabled).toBe(true);
    fireEvent.change(torn.getByLabelText("Leg for this plan"), { target: { value: "f-901|1" } });
    expect(torn.getByRole("option", { name: "PGR901 leg 1 · PANC → PABE · 2026-10-08 19:00Z" })).toBeTruthy();
    fireEvent.click(put);
    await waitFor(() => expect(actions.assignPlanAction).toHaveBeenCalledWith(TORN.id, "f-901", 1));
  });

  it("offers only setting aside a plan for an aircraft we don't fly", async () => {
    actions.ignorePlanAction.mockResolvedValue({ ok: false, error: "That plan or flight is gone. Refresh the page." });
    render(<PlanQueue plans={[STRAY]} />);
    expect(screen.getByText(/No flight on N999ZZ within a day of it\./)).toBeTruthy();
    expect(screen.queryByLabelText("Leg for this plan")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Set aside" }));
    await waitFor(() => expect(actions.ignorePlanAction).toHaveBeenCalledWith(STRAY.id));
    expect((await screen.findByRole("alert")).textContent).toBe("That plan or flight is gone. Refresh the page.");
  });

  it("says when nothing waits", () => {
    render(<PlanQueue plans={[]} />);
    expect(screen.getByText("Nothing waiting")).toBeTruthy();
  });
});
