import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";
import type {
  FlightAssignmentResponse,
  FlightDetail,
  LoadTeamResponse,
} from "@/lib/api/types";

// Same stubs as the other packet panels: @/lib/api/client drags in
// next-auth, and the actions module drags in next/cache.
const { TestApiError, listLoadTeams, getFlightAssignment } = vi.hoisted(() => {
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
    listLoadTeams: vi.fn(),
    getFlightAssignment: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ listLoadTeams, getFlightAssignment }));
vi.mock("@/components/load-teams/assign-actions", () => ({
  assignFlightAction: vi.fn(),
  unassignFlightAction: vi.fn(),
}));

import { LoadTeamPanel } from "./load-team-panel";

const FLIGHT: FlightDetail = {
  id: "f-1",
  flight_number: "PGR900",
  origin: "PANC",
  destination: "PAFA",
  scheduled_departure_at: "2026-09-27T14:00:00Z",
  scheduled_arrival_at: "2026-09-27T15:00:00Z",
  status: "scheduled",
  aircraft: {
    id: "ac-1",
    tail_number: "N207GE",
    model: "Cessna 208 Caravan",
    seats: 9,
  },
  pax_count: 4,
  cargo_lbs: 200,
  notes: null,
  max_payload_lbs: 3000,
  released_at: null,
  released_by: null,
};

function team(over: Partial<LoadTeamResponse> = {}): LoadTeamResponse {
  return {
    id: "t-alpha",
    team_name: "Alpha",
    base_icao: "PANC",
    team_lead: { id: "u-1", full_name: "Dana Ruiz", email: "d@x.test" },
    color_code: "#2563eb",
    is_active: true,
    notes: null,
    member_count: 4,
    ...over,
  };
}

const ALPHA = team();
const BRAVO = team({
  id: "t-bravo",
  team_name: "Bravo",
  team_lead: null,
  member_count: 1,
});
const FAIRBANKS = team({ id: "t-fai", team_name: "Fairbanks", base_icao: "PAFA" });

function assignedTo(t: {
  id: string;
  team_name: string;
  base_icao: string;
  color_code: string;
}): FlightAssignmentResponse {
  return {
    id: "a-1",
    flight: { id: "f-1" } as FlightAssignmentResponse["flight"],
    load_team: {
      id: t.id,
      team_name: t.team_name,
      base_icao: t.base_icao,
      color_code: t.color_code,
    },
    assigned_by: null,
    assigned_at: "2026-09-27T12:00:00Z",
    cleared_at: null,
    cleared_by: null,
    note: null,
  };
}

async function renderPanel(flight: FlightDetail | null = FLIGHT) {
  return render(await LoadTeamPanel({ flight }));
}

const teamButtons = () =>
  screen.queryAllByRole("button", { name: /^Assign / });

beforeEach(() => {
  vi.clearAllMocks();
  listLoadTeams.mockResolvedValue({ items: [ALPHA, BRAVO, FAIRBANKS], total: 3 });
  getFlightAssignment.mockResolvedValue(null);
});

describe("LoadTeamPanel", () => {
  it("asks for a flight first, without a Soon pill or a fetch", async () => {
    await renderPanel(null);
    expect(
      screen.getByText(/Pick a flight from the dropdown above/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/soon/i)).not.toBeInTheDocument();
    expect(listLoadTeams).not.toHaveBeenCalled();
  });

  it("offers the departure base's teams, with lead and member count", async () => {
    await renderPanel();
    expect(getFlightAssignment).toHaveBeenCalledWith("f-1");
    expect(teamButtons().map((b) => b.textContent)).toEqual([
      "Assign AlphaDana Ruiz · 4 members",
      "Assign BravoNo lead · 1 member",
    ]);
    expect(screen.getByText("PANC")).toBeInTheDocument();
    expect(
      screen.getByText("Not assigned — pick the team that loads PGR900."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Clear/ })).toBeNull();
  });

  it("marks the assigned team instead of offering it, and offers Clear", async () => {
    getFlightAssignment.mockResolvedValue(assignedTo(ALPHA));
    await renderPanel();
    expect(teamButtons().map((b) => b.textContent)).toEqual([
      "Assign BravoNo lead · 1 member",
    ]);
    const marked = screen.getByText("Assigned").parentElement!;
    expect(within(marked).getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText(/is assigned to/)).toHaveTextContent(
      "PGR900 is assigned to Alpha.",
    );
    expect(
      screen.getByRole("button", { name: "Clear load team Alpha" }),
    ).toBeInTheDocument();
  });

  it("still shows a team assigned from another base, first", async () => {
    getFlightAssignment.mockResolvedValue(assignedTo(FAIRBANKS));
    await renderPanel();
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(
      "FairbanksDana Ruiz · 4 members · based at PAFAAssigned",
    );
    expect(teamButtons()).toHaveLength(2);
  });

  it("names a team deactivated since it was assigned", async () => {
    getFlightAssignment.mockResolvedValue(
      assignedTo({ ...ALPHA, id: "t-old", team_name: "Charlie" }),
    );
    await renderPanel();
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent(
      "CharlieInactive teamAssigned",
    );
  });

  it("says when the base has no teams, without sending anyone to Settings", async () => {
    listLoadTeams.mockResolvedValue({ items: [FAIRBANKS], total: 1 });
    await renderPanel();
    expect(screen.getByText("No load teams at PANC.")).toBeInTheDocument();
    expect(screen.queryByText(/settings/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it.each(["cancelled", "completed"] as const)(
    "shows a %s flight's team read-only",
    async (status) => {
      getFlightAssignment.mockResolvedValue(assignedTo(ALPHA));
      await renderPanel({ ...FLIGHT, status });
      expect(screen.queryAllByRole("button")).toHaveLength(0);
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
      expect(screen.getByText("Assigned")).toBeInTheDocument();
      expect(
        screen.getByText(`This flight is ${status} — its load team can't be changed.`),
      ).toBeInTheDocument();
    },
  );

  it("says a closed flight had no team, rather than offering teams", async () => {
    await renderPanel({ ...FLIGHT, status: "cancelled" });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(
      screen.getByText("No load team was assigned. This flight is cancelled."),
    ).toBeInTheDocument();
  });

  it("keeps offering teams once released", async () => {
    await renderPanel({ ...FLIGHT, status: "released" });
    expect(teamButtons()).toHaveLength(2);
  });

  it.each([
    [401, "Session expired — sign in again to load teams."],
    [500, "Load teams unavailable — try refreshing in a moment."],
  ])("reports a %i instead of an empty list", async (status, message) => {
    getFlightAssignment.mockRejectedValue(new TestApiError(status, "/x", ""));
    await renderPanel();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(teamButtons()).toHaveLength(0);
  });

  it("has no a11y violations with a team assigned", async () => {
    getFlightAssignment.mockResolvedValue(assignedTo(ALPHA));
    const { container } = await renderPanel();
    await expectNoA11yViolations(container);
  });
});
