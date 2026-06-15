import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BoardFlightItem,
  CompanyBaseResponse,
  LoadTeamResponse,
} from "@/lib/api/types";

const {
  TestApiError,
  listCompanyBases,
  getFlightBoard,
  listLoadTeams,
} = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    TestApiError,
    listCompanyBases: vi.fn(),
    getFlightBoard: vi.fn(),
    listLoadTeams: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/auth", () => ({ listCompanyBases }));
vi.mock("@/lib/api/flight-following", () => ({ getFlightBoard }));
vi.mock("@/lib/api/ground", () => ({ listLoadTeams }));
vi.mock("./base-filter", () => ({
  BaseFilter: ({ active }: { active: string | null }) => (
    <div data-testid="base-filter" data-active={active ?? ""} />
  ),
}));

import RampOpsPage from "./page";

function makeBase(overrides: Partial<CompanyBaseResponse>): CompanyBaseResponse {
  return {
    id: "b-1",
    icao: "PANC",
    display_name: "Anchorage",
    city: null,
    state: null,
    timezone: null,
    is_hub: true,
    is_active: true,
    manager_name: null,
    manager_phone: null,
    manager_email: null,
    notes: null,
    ...overrides,
  };
}

function makeFlight(overrides: Partial<BoardFlightItem>): BoardFlightItem {
  return {
    id: "f-1",
    flight_number: "PER123",
    aircraft: { id: "a-1", tail_number: "N207GE", model: "C208", seats: 9 },
    origin: "PANC",
    destination: "PAAQ",
    scheduled_departure_at: "2026-06-15T18:00:00Z",
    scheduled_arrival_at: "2026-06-15T19:00:00Z",
    actual_departure_at: null,
    actual_arrival_at: null,
    status: "scheduled",
    pax_count: 4,
    cargo_lbs: 200,
    pic_name: null,
    is_overdue: false,
    last_contact_at: null,
    ...overrides,
  };
}

function makeTeam(overrides: Partial<LoadTeamResponse>): LoadTeamResponse {
  return {
    id: "t-1",
    team_name: "Team Alpha",
    base_icao: "PANC",
    team_lead: { id: "u-1", full_name: "Lead Ramp", email: "lead@x" },
    color_code: "#3B82F6",
    is_active: true,
    notes: null,
    member_count: 3,
    ...overrides,
  };
}

beforeEach(() => {
  listCompanyBases.mockReset();
  getFlightBoard.mockReset();
  listLoadTeams.mockReset();
  // Sane defaults — most tests just override the one fixture they care about.
  listCompanyBases.mockResolvedValue({ items: [], total: 0 });
  getFlightBoard.mockResolvedValue({ items: [], view: "today", total: 0 });
  listLoadTeams.mockResolvedValue({ items: [], total: 0 });
});

async function renderPage(search: { base?: string } = {}) {
  const ui = await RampOpsPage({ searchParams: Promise.resolve(search) });
  return render(ui);
}

describe("RampOpsPage (M2 redesign)", () => {
  it("renders the two-column layout with header chip + flight count", async () => {
    getFlightBoard.mockResolvedValueOnce({
      items: [makeFlight({}), makeFlight({ id: "f-2", flight_number: "PER456" })],
      view: "today",
      total: 2,
    });
    listLoadTeams.mockResolvedValueOnce({
      items: [makeTeam({})],
      total: 1,
    });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: /ramp operations/i, level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /today's flights/i, level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^load teams$/i, level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 flights/i)).toBeInTheDocument();
    expect(screen.getByText("PER123")).toBeInTheDocument();
    expect(screen.getByText("Team Alpha")).toBeInTheDocument();
  });

  it("filters the flight list when ?base=PAAQ is passed", async () => {
    listCompanyBases.mockResolvedValueOnce({
      items: [makeBase({ icao: "PAAQ" })],
      total: 1,
    });
    getFlightBoard.mockResolvedValueOnce({
      items: [
        makeFlight({ id: "f-1", origin: "PANC", destination: "PAJN" }), // no PAAQ
        makeFlight({ id: "f-2", origin: "PAAQ", destination: "PANC" }),
      ],
      view: "today",
      total: 2,
    });

    await renderPage({ base: "PAAQ" });

    // Header reflects the filtered count (1) and the team column shows
    // the filter chip
    expect(screen.getByText(/1 flight/i)).toBeInTheDocument();
    // listLoadTeams should be called with baseIcao=PAAQ to scope teams
    expect(listLoadTeams).toHaveBeenCalledWith({ baseIcao: "PAAQ" });
  });

  it("renders the Today's Flights empty state when nothing is scheduled", async () => {
    await renderPage();
    expect(screen.getByText(/^no flights today\.$/i)).toBeInTheDocument();
  });

  it("renders the Load Teams empty state with a Create teams link", async () => {
    await renderPage();
    expect(screen.getByText(/no teams\./i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /create teams/i }),
    ).toHaveAttribute("href", "/settings/load-teams");
  });

  it("disables the Assign team button (M2-M-25e gates the backend)", async () => {
    getFlightBoard.mockResolvedValueOnce({
      items: [makeFlight({})],
      view: "today",
      total: 1,
    });

    await renderPage();

    const btn = screen.getByRole("button", { name: /assign team/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", expect.stringMatching(/M2-M-25e/));
  });

  it("surfaces an aggregated error banner on partial fetch failure", async () => {
    listLoadTeams.mockRejectedValueOnce(new TestApiError(500, "/teams", "x"));

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/load teams/i);
  });

  it("shows session-expired when any fetch returns 401", async () => {
    getFlightBoard.mockRejectedValueOnce(
      new TestApiError(401, "/board", "expired"),
    );

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/session expired/i);
  });
});
