import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FlightStats } from "@/lib/api/types";
import type { OperationalSnapshot } from "@/lib/dashboards/operational-snapshot";

/**
 * The Admin dashboards print only what they measured.
 *
 * Their unwired tiles and panels used to print numbers anyway — "$0
 * Revenue MTD", "0% Profit Margin", "0/0 Crew Current", "0 Crew Expired
 * — check before dispatch" — and sentences like "No overrides in the
 * last 90 days" about data they never read, with a small "M3" pill as
 * the only sign. They say "Not built yet" now, and the pills are gone.
 */

const counts = { scheduled: 2, released: 1, cancelled: 0, completed: 1, total: 4 };
const stats: FlightStats = {
  today: counts,
  this_week: counts,
  aircraft_total: 4,
  aircraft_active: 3,
  last_release_at: null,
};
const snapshot = {
  alerts: [],
  airborneCount: 1,
  releasedCount: 1,
  fleetTotal: 4,
  fleetAirworthy: 3,
  fleetGrounded: 1,
  flightsByOrigin: new Map(),
  board: [],
  fleet: [],
} as unknown as OperationalSnapshot;

vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/dashboards/operational-snapshot", () => ({
  loadOperationalSnapshot: vi.fn(async () => snapshot),
}));
vi.mock("@/lib/api/ops", () => ({
  getFlightStats: vi.fn(async () => stats),
  listFlights: vi.fn(async () => ({ items: [], total: 0 })),
}));
vi.mock("@/lib/api/auth", () => ({
  listMyTenants: vi.fn(async () => ({
    tenants: [
      { id: "t-1", name: "Peregrine Test Air", slug: "pta", plan: "owner", is_current: true },
    ],
  })),
}));

import ChiefPilotDashboardPage from "./chief-pilot/page";
import DirectorOpsDashboardPage from "./director-ops/page";
import DispatcherDashboardPage from "./dispatcher/page";
import ExecutiveDashboardPage from "./executive/page";

afterEach(cleanup);

/** The tile whose label is `label` — its value sits beside it. */
function tile(label: string): HTMLElement {
  const el = screen.getByText(label);
  let node: HTMLElement | null = el;
  while (node && !node.className?.toString().includes("rounded")) {
    node = node.parentElement;
  }
  return node ?? el;
}

function expectNoMilestonePills() {
  for (const code of ["M2", "M3", "M4"]) {
    expect(screen.queryByText(code, { exact: true })).toBeNull();
  }
}

describe("executive dashboard", () => {
  it("says the money tiles are not built instead of printing $0", async () => {
    render(await ExecutiveDashboardPage());
    for (const label of [
      "Revenue MTD",
      "Profit Margin",
      "Rev / FH",
      "30d Forecast",
      "Outstanding AR",
      "Crew Current",
      "Overrides (30d)",
    ]) {
      const t = tile(label);
      expect(within(t).getByText("—")).toBeInTheDocument();
      expect(within(t).getByText("Not built yet")).toBeInTheDocument();
    }
    expect(screen.queryByText("$0")).toBeNull();
    expect(screen.queryByText("0%")).toBeNull();
    // A measured tile keeps its number.
    expect(within(tile("Fleet Airworthy")).getByText("3/4")).toBeInTheDocument();
    expectNoMilestonePills();
  });
});

describe("chief pilot dashboard", () => {
  it("does not claim nothing happened in panels it never reads", async () => {
    render(await ChiefPilotDashboardPage());
    for (const claim of [
      /no pilot data in the last 90 days/i,
      /no high\/extreme dispatches/i,
      /no overrides in the last 90 days/i,
      /no achievements yet/i,
    ]) {
      expect(screen.queryByText(claim)).toBeNull();
    }
    for (const label of ["Active Crew", "Fully Current", "Expired", "Expiring Soon"]) {
      expect(within(tile(label)).getByText("Not built yet")).toBeInTheDocument();
    }
    expectNoMilestonePills();
  });
});

describe("director of operations dashboard", () => {
  it("drops the hardcoded crew and risk rows", async () => {
    render(await DirectorOpsDashboardPage());
    expect(screen.queryByText("PICs current")).toBeNull();
    expect(screen.queryByText("Extreme")).toBeNull();
    expect(
      screen.getByText(/not built here yet — pilot currency is on fleet compliance/i),
    ).toBeInTheDocument();
    expectNoMilestonePills();
  });
});

describe("dispatcher dashboard", () => {
  it("does not reassure a dispatcher that no crew are expired", async () => {
    render(await DispatcherDashboardPage());
    const t = tile("Crew Expired");
    expect(within(t).getByText("—")).toBeInTheDocument();
    expect(within(t).queryByText("check before dispatch")).toBeNull();
    expectNoMilestonePills();
  });
});
