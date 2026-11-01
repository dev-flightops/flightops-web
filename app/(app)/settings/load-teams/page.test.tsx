import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LoadTeamResponse } from "@/lib/api/types";

const { TestApiError, listLoadTeams, listStations, listStaff } = vi.hoisted(
  () => {
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
      listStations: vi.fn(),
      listStaff: vi.fn(),
    };
  },
);
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ listLoadTeams, listStations }));
vi.mock("@/lib/api/auth", () => ({ listStaff }));
vi.mock("./actions", () => ({
  saveTeamAction: vi.fn(),
  setTeamActiveAction: vi.fn(),
  listMembersAction: vi.fn(),
  addMemberAction: vi.fn(),
  removeMemberAction: vi.fn(),
}));

import SettingsLoadTeamsPage from "./page";

function team(over: Partial<LoadTeamResponse>): LoadTeamResponse {
  return {
    id: "t-a",
    team_name: "Alpha",
    base_icao: "PANC",
    team_lead: null,
    color_code: "#2563eb",
    is_active: true,
    notes: null,
    member_count: 2,
    ...over,
  };
}

async function renderPage(search: Record<string, string> = {}) {
  return render(
    await SettingsLoadTeamsPage({ searchParams: Promise.resolve(search) }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listLoadTeams.mockResolvedValue({
    items: [
      team({}),
      team({ id: "t-b", team_name: "Bethel Crew", base_icao: "PABE" }),
    ],
    total: 2,
  });
  listStations.mockResolvedValue({
    items: [
      { icao_code: "PANC", name: "Anchorage", is_active: true },
      { icao_code: "PABE", name: "Bethel", is_active: true },
    ],
    total: 2,
  });
  listStaff.mockResolvedValue({ items: [], total: 0 });
});

describe("Settings → Load Teams", () => {
  it("heads each base with its station name and an Add Team for it", async () => {
    await renderPage();
    const anc = screen.getByRole("region", { name: "PANC load teams" });
    expect(within(anc).getByRole("heading", { name: "PANC — Anchorage" })).toBeInTheDocument();
    expect(within(anc).getByRole("button", { name: "+ Add Team at PANC" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "PABE — Bethel" })).toBeInTheDocument();
  });

  it("gives every team working Edit, Members and Deactivate", async () => {
    await renderPage();
    for (const name of ["Edit Alpha", "Members of Alpha", "Deactivate Alpha", "+ Add Team"]) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    }
  });

  it("shows nothing that isn't built, and nothing looks live but dead (#134)", async () => {
    // Fleet Report, Reminders, Activity Log and Performance were dimmed and
    // "Not built yet"; the client counts such marks as faults.
    const { container } = await renderPage();
    for (const label of ["Fleet Report", "Reminders", "Activity Log", "Performance"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    expect(container.querySelectorAll("button:disabled, [aria-disabled='true']")).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/follow-up|backend endpoints are live|Not built/i);
  });

  it("lists archived teams when asked", async () => {
    await renderPage({ status: "all" });
    expect(listLoadTeams).toHaveBeenCalledWith({ includeInactive: true });
    expect(screen.getByRole("link", { name: "Hide Inactive" })).toBeInTheDocument();
  });

  it("still works when the staff list can't be read", async () => {
    listStaff.mockRejectedValue(new TestApiError(500, "/auth/directory", ""));
    await renderPage();
    expect(screen.getByRole("button", { name: "Edit Alpha" })).toBeEnabled();
  });

  it("offers people from the staff directory, which a DO may read (#60)", async () => {
    listStaff.mockResolvedValue({
      items: [{ id: "u-1", full_name: "Rachel Nordstrom", email: "do@x.test", roles: ["director_of_operations"] }],
      total: 1,
    });
    await renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: "Edit Alpha" }));
    expect(
      screen.getByRole("option", { name: "Rachel Nordstrom (Director of Operations)" }),
    ).toBeInTheDocument();
  });

  it("offers to create a team when there are none", async () => {
    listLoadTeams.mockResolvedValue({ items: [], total: 0 });
    await renderPage();
    expect(screen.getByRole("button", { name: "Create a team" })).toBeEnabled();
  });

  it("says when teams can't be loaded", async () => {
    listLoadTeams.mockRejectedValue(new TestApiError(500, "/x", ""));
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Load teams unavailable. Try refreshing in a moment.",
    );
  });
});
