import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ComplianceBoardResponse, FlightStats } from "@/lib/api/types";
import type { OperationalSnapshot } from "@/lib/dashboards/operational-snapshot";

/**
 * The Admin dashboards print only what they measured.
 *
 * Their unwired tiles and panels used to print numbers anyway — "$0
 * Revenue MTD", "0% Profit Margin", "0/0 Crew Current", "0 Crew Expired
 * — check before dispatch" — and sentences like "No overrides in the
 * last 90 days" about data they never read, with a small "M3" pill as
 * the only sign. They said "Not built yet" next, which the client counted
 * as seven unfinished tiles (#157). Now the crew tiles read the currency
 * board and receivables read billing; what has nothing behind it isn't
 * shown, and neither is a tile whose source didn't load.
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

const board: ComplianceBoardResponse = {
  items: [
    { id: "i-med", code: "medical_certificate", name: "Medical" },
    { id: "i-pc", code: "pc_135_299", name: "135.299 Line Check" },
  ] as ComplianceBoardResponse["items"],
  rows: [
    {
      pilot: { id: "p-1", full_name: "Bob Hargrove" },
      overall_status: "upcoming",
      cells: [
        { currency_item_id: "i-med", status: "upcoming", base_month_due: "2027-04" },
        { currency_item_id: "i-pc", status: "upcoming", base_month_due: "2027-01" },
      ],
    },
    {
      pilot: { id: "p-2", full_name: "Tomas Eklund" },
      overall_status: "non_current",
      cells: [
        { currency_item_id: "i-med", status: "non_current", base_month_due: "2026-09" },
        { currency_item_id: "i-pc", status: "upcoming", base_month_due: "2027-02" },
      ],
    },
  ] as unknown as ComplianceBoardResponse["rows"],
  chips: { fully_current: 1, early_month: 0, grace_month: 0, non_current: 1, records_missing: 0 },
};
const { boardMock, invoicesMock } = vi.hoisted(() => ({
  boardMock: vi.fn(),
  invoicesMock: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/dashboards/operational-snapshot", () => ({
  loadOperationalSnapshot: vi.fn(async () => snapshot),
}));
vi.mock("@/lib/api/ops", () => ({
  getFlightStats: vi.fn(async () => stats),
  listFlights: vi.fn(async () => ({ items: [], total: 0 })),
  getComplianceBoard: boardMock,
  getMorningToday: vi.fn(async () => ({ company_date: "2026-10-31", items: [] })),
}));
vi.mock("@/lib/api/customer-invoices", () => ({ listCustomerInvoices: invoicesMock }));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ roles: ["dispatcher"] })) }));
vi.mock("@/lib/api/auth", () => ({
  listStaff: vi.fn(async () => ({ items: [], total: 0 })),
  listMyTenants: vi.fn(async () => ({
    tenants: [
      { id: "t-1", name: "Peregrine Test Air", slug: "pta", plan: "owner", is_current: true },
    ],
  })),
}));
vi.mock("@/lib/api/reports", () => ({
  getOpsScore: vi.fn(async () => ({
    as_of: "2026-10-20",
    score: 97,
    max_achievable: 97,
    band: "excellent",
    pillars: [],
    advisory: "",
  })),
}));

import ChiefPilotDashboardPage from "./chief-pilot/page";
import DirectorOpsDashboardPage from "./director-ops/page";
import DispatcherDashboardPage from "./dispatcher/page";
import ExecutiveDashboardPage from "./executive/page";
import OpsScoreDashboardPage from "./ops-score/page";

afterEach(cleanup);
beforeEach(() => {
  boardMock.mockReset().mockResolvedValue(board);
  invoicesMock.mockReset().mockResolvedValue({ items: [], total: 0, outstanding_cents: 260000 });
});

/** The tile whose label is `label` — its value sits beside it. */
function tile(label: string): HTMLElement {
  const el = screen.getByText(label);
  return (el.closest("[data-stat-tile]") as HTMLElement | null) ?? el;
}

function expectNoMilestonePills() {
  for (const code of ["M2", "M3", "M4"]) {
    expect(screen.queryByText(code, { exact: true })).toBeNull();
  }
}

describe("executive dashboard", () => {
  it("reads crew from the currency board and receivables from billing, and shows no unbuilt tile", async () => {
    render(await ExecutiveDashboardPage());
    expect(within(tile("Crew Current")).getByText("1/2")).toBeInTheDocument();
    expect(within(tile("Outstanding AR")).getByText("$2,600")).toBeInTheDocument();
    for (const label of ["Revenue MTD", "Profit Margin", "Rev / FH", "30d Forecast", "Overrides (30d)"]) {
      expect(screen.queryByText(label)).toBeNull();
    }
    expect(screen.queryByText("Not built yet")).toBeNull();
    expect(screen.queryByText("0%")).toBeNull();
    // A measured tile keeps its number.
    expect(within(tile("Fleet Airworthy")).getByText("3/4")).toBeInTheDocument();
    expectNoMilestonePills();
  });

  it("leaves a tile out when its source doesn't load, rather than print zero", async () => {
    boardMock.mockRejectedValue(new Error("down"));
    invoicesMock.mockRejectedValue(new Error("down"));
    render(await ExecutiveDashboardPage());
    expect(screen.queryByText("Crew Current")).toBeNull();
    expect(screen.queryByText("Outstanding AR")).toBeNull();
    expect(screen.queryByText("$0")).toBeNull();
  });
});

describe("chief pilot dashboard", () => {
  it("reads the crew tiles and matrix from the currency board", async () => {
    render(await ChiefPilotDashboardPage());
    for (const claim of [
      /no pilot data in the last 90 days/i,
      /no high\/extreme dispatches/i,
      /no overrides in the last 90 days/i,
      /no achievements yet/i,
    ]) {
      expect(screen.queryByText(claim)).toBeNull();
    }
    expect(within(tile("Active Crew")).getByText("2")).toBeInTheDocument();
    expect(within(tile("Fully Current")).getByText("1/2")).toBeInTheDocument();
    expect(within(tile("Expired")).getByText("1")).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Tomas Eklund/ });
    expect(within(row).getByText("2026-09")).toBeInTheDocument();
    expect(within(row).getByText("Not current")).toBeInTheDocument();
    expect(within(row).getByText("Medical")).toBeInTheDocument();
    expect(screen.queryByText(/not built yet/i)).toBeNull();
    expectNoMilestonePills();
  });
});

describe("director of operations dashboard", () => {
  it("drops the hardcoded crew and risk rows", async () => {
    render(await DirectorOpsDashboardPage());
    expect(screen.queryByText("PICs current")).toBeNull();
    expect(screen.queryByText("Extreme")).toBeNull();
    expect(screen.queryByText(/not built/i)).toBeNull();
    expectNoMilestonePills();
  });
});

describe("ops score dashboard", () => {
  it("does not chart weeks nothing computed", async () => {
    render(await OpsScoreDashboardPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Not computed yet")).toBeInTheDocument();
    // Seven weeks at 0%, and the day's score passed off as this week's
    // completion.
    expect(screen.queryByText("0%")).toBeNull();
    expect(screen.queryByText("97%")).toBeNull();
    expect(screen.queryByText(/based on recorded dispatchoutcomes/i)).toBeNull();
  });
});

describe("dispatcher dashboard", () => {
  it("counts expired crew from the currency board", async () => {
    render(await DispatcherDashboardPage());
    const t = tile("Crew Expired");
    expect(within(t).getByText("1")).toBeInTheDocument();
    expectNoMilestonePills();
  });

  it("does not reassure a dispatcher that no crew are expired when the board didn't load", async () => {
    boardMock.mockRejectedValue(new Error("down"));
    render(await DispatcherDashboardPage());
    expect(screen.queryByText("Crew Expired")).toBeNull();
  });
});
