import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createLoadTeam,
  updateLoadTeam,
  listLoadTeamMembers,
  addLoadTeamMember,
  removeLoadTeamMember,
  revalidatePath,
  TestApiError,
} = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  }
  return {
    createLoadTeam: vi.fn(),
    updateLoadTeam: vi.fn(),
    listLoadTeamMembers: vi.fn(),
    addLoadTeamMember: vi.fn(),
    removeLoadTeamMember: vi.fn(),
    revalidatePath: vi.fn(),
    TestApiError,
  };
});

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({
  createLoadTeam,
  updateLoadTeam,
  listLoadTeamMembers,
  addLoadTeamMember,
  removeLoadTeamMember,
}));

import {
  addMemberAction,
  removeMemberAction,
  saveTeamAction,
  setTeamActiveAction,
} from "./actions";

const TEAM = "11111111-1111-4111-8111-111111111111";
const LEAD = "22222222-2222-4222-8222-222222222222";
const MEMBER = "33333333-3333-4333-8333-333333333333";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const VALID = {
  team_name: "  Alpha Crew ",
  base_icao: "panc",
  color_code: "#22c55e",
  notes: "",
};

function expectAllPagesRefreshed() {
  expect(revalidatePath).toHaveBeenCalledWith("/settings/load-teams");
  expect(revalidatePath).toHaveBeenCalledWith("/ramp-ops");
  expect(revalidatePath).toHaveBeenCalledWith("/dispatch");
}

beforeEach(() => {
  vi.clearAllMocks();
  createLoadTeam.mockResolvedValue({});
  // What the server sends back once it has applied VALID.
  updateLoadTeam.mockResolvedValue({ base_icao: "PANC", team_lead: null });
});

describe("saveTeamAction — create", () => {
  it("trims the name, uppercases the base, and sends a picked lead", async () => {
    const result = await saveTeamAction(
      form({ ...VALID, team_lead_user_id: LEAD, notes: " Weekdays " }),
    );
    expect(result).toEqual({ status: "ok" });
    expect(createLoadTeam).toHaveBeenCalledWith({
      team_name: "Alpha Crew",
      base_icao: "PANC",
      color_code: "#22c55e",
      notes: "Weekdays",
      team_lead_user_id: LEAD,
    });
    expect(updateLoadTeam).not.toHaveBeenCalled();
    expectAllPagesRefreshed();
  });

  it("creates without a lead for — No Lead —, and without notes when blank", async () => {
    await saveTeamAction(form({ ...VALID, team_lead_user_id: "" }));
    expect(createLoadTeam).toHaveBeenCalledWith({
      team_name: "Alpha Crew",
      base_icao: "PANC",
      color_code: "#22c55e",
      notes: null,
    });
  });

  it.each([
    ["team_name", { team_name: "   " }, "Give the team a name."],
    ["base_icao", { base_icao: "" }, "Pick the team's base."],
    ["color_code", { color_code: "blue" }, "Pick a colour."],
  ])("refuses a bad %s without calling the API", async (field, change, message) => {
    const result = await saveTeamAction(form({ ...VALID, ...change }));
    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { [field]: message },
    });
    expect(createLoadTeam).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("names the clash when the base already has that team", async () => {
    createLoadTeam.mockRejectedValue(new TestApiError(409, "/x", "{}"));
    const result = await saveTeamAction(form(VALID));
    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { team_name: "PANC already has a team called “Alpha Crew”." },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("saveTeamAction — edit", () => {
  it("clears the lead and the notes when they're emptied", async () => {
    await saveTeamAction(
      form({ ...VALID, team_id: TEAM, team_lead_user_id: "" }),
    );
    expect(updateLoadTeam).toHaveBeenCalledWith(TEAM, {
      team_name: "Alpha Crew",
      base_icao: "PANC",
      color_code: "#22c55e",
      notes: null,
      team_lead_user_id: null,
    });
    expect(createLoadTeam).not.toHaveBeenCalled();
    expectAllPagesRefreshed();
  });

  it("leaves the lead alone when the form had no lead picker", async () => {
    await saveTeamAction(form({ ...VALID, team_id: TEAM }));
    const [, body] = updateLoadTeam.mock.calls[0];
    expect(body).not.toHaveProperty("team_lead_user_id");
  });

  it("says so when the server didn't apply a base change or lead removal", async () => {
    // A ground service from before fix/load-team-edit ignores both.
    updateLoadTeam.mockResolvedValue({
      base_icao: "PABE",
      team_lead: { id: LEAD, full_name: "Dana Ruiz", email: "d@x.test" },
    });
    const result = await saveTeamAction(
      form({ ...VALID, team_id: TEAM, team_lead_user_id: "" }),
    );
    expect(result).toEqual({
      status: "error",
      message:
        "Saved, except the base and removing the lead: the server can't change that yet.",
    });
    expectAllPagesRefreshed();
  });

  it("refuses a lead that isn't an id", async () => {
    const result = await saveTeamAction(
      form({ ...VALID, team_id: TEAM, team_lead_user_id: "Dana" }),
    );
    expect(result).toEqual({ status: "error", message: "Pick the lead from the list." });
    expect(updateLoadTeam).not.toHaveBeenCalled();
  });

  it.each([
    [401, "Your session expired — please sign in again."],
    [403, "You don't have permission to manage load teams."],
    [404, "That team, or the lead you picked, no longer exists — refresh and try again."],
    [500, "Couldn't save the team (HTTP 500). Try again."],
  ])("explains a %i", async (status, message) => {
    updateLoadTeam.mockRejectedValue(new TestApiError(status, "/x", ""));
    expect(await saveTeamAction(form({ ...VALID, team_id: TEAM }))).toEqual({
      status: "error",
      message,
    });
  });
});

describe("setTeamActiveAction", () => {
  it("deactivates and refreshes every page that lists teams", async () => {
    expect(await setTeamActiveAction(TEAM, false)).toEqual({ ok: true });
    expect(updateLoadTeam).toHaveBeenCalledWith(TEAM, { is_active: false });
    expectAllPagesRefreshed();
  });
});

describe("members", () => {
  it("treats adding someone already on the team as done", async () => {
    addLoadTeamMember.mockRejectedValue(new TestApiError(409, "/x", ""));
    expect(await addMemberAction(TEAM, LEAD)).toEqual({ ok: true });
    expectAllPagesRefreshed();
  });

  it("reports other add failures", async () => {
    addLoadTeamMember.mockRejectedValue(new TestApiError(500, "/x", ""));
    expect(await addMemberAction(TEAM, LEAD)).toEqual({
      ok: false,
      error: "Couldn't add the member (HTTP 500). Try again.",
    });
  });

  it("treats removing someone already gone as done", async () => {
    removeLoadTeamMember.mockRejectedValue(new TestApiError(404, "/x", ""));
    expect(await removeMemberAction(TEAM, MEMBER)).toEqual({ ok: true });
    expect(removeLoadTeamMember).toHaveBeenCalledWith(TEAM, MEMBER);
  });
});
