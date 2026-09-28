import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LoadTeamMemberResponse, LoadTeamResponse } from "@/lib/api/types";

const { listMembersAction, addMemberAction, removeMemberAction } = vi.hoisted(() => ({
  listMembersAction: vi.fn(),
  addMemberAction: vi.fn(),
  removeMemberAction: vi.fn(),
}));
vi.mock("./actions", () => ({ listMembersAction, addMemberAction, removeMemberAction }));

import { MembersSheet } from "./members-sheet";
import type { PersonOption } from "./team-dialog";

const TEAM: LoadTeamResponse = {
  id: "t-1",
  team_name: "Alpha",
  base_icao: "PANC",
  team_lead: { id: "u-zed", full_name: "Zed Lead", email: "z@x.test" },
  color_code: "#2563eb",
  is_active: true,
  notes: null,
  member_count: 2,
};
const PEOPLE: PersonOption[] = [
  { id: "u-amy", name: "Amy Ramp", roles: "Ground Ops" },
  { id: "u-bo", name: "Bo Ramp", roles: "Ground Ops" },
  { id: "u-zed", name: "Zed Lead", roles: "Ground Ops" },
];

function member(id: string, userId: string, name: string): LoadTeamMemberResponse {
  return {
    id,
    team_id: "t-1",
    user: { id: userId, full_name: name, email: `${userId}@x.test` },
    is_active: true,
    joined_date: "2026-09-01",
    notes: null,
  };
}
const AMY = member("m-amy", "u-amy", "Amy Ramp");
const ZED = member("m-zed", "u-zed", "Zed Lead");

async function openSheet(people: PersonOption[] | null = PEOPLE) {
  const user = userEvent.setup();
  render(<MembersSheet team={TEAM} people={people} />);
  await user.click(screen.getByRole("button", { name: "Members of Alpha" }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  listMembersAction.mockResolvedValue({ ok: true, members: [AMY, ZED] });
  addMemberAction.mockResolvedValue({ ok: true });
  removeMemberAction.mockResolvedValue({ ok: true });
});
afterEach(() => vi.restoreAllMocks());

describe("MembersSheet", () => {
  it("lists the lead first, then by name, with role and join date", async () => {
    await openSheet();
    const items = await screen.findAllByRole("listitem");
    expect(listMembersAction).toHaveBeenCalledWith("t-1");
    expect(items.map((li) => li.textContent)).toEqual([
      "Zed LeadLeadGround Ops · Joined Sep 1, 2026",
      "Amy RampGround Ops · Joined Sep 1, 2026",
    ]);
  });

  it("adds someone who isn't on the team yet", async () => {
    const user = await openSheet();
    await screen.findAllByRole("listitem");
    const pick = screen.getByLabelText("Employee to add");
    expect(within(pick).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "— Select Employee —",
      "Bo Ramp (Ground Ops)",
    ]);
    await user.selectOptions(pick, "u-bo");
    await user.click(screen.getByRole("button", { name: "+ Add" }));
    await waitFor(() => expect(addMemberAction).toHaveBeenCalledWith("t-1", "u-bo"));
    await waitFor(() => expect(listMembersAction).toHaveBeenCalledTimes(2));
  });

  it("removes a member once confirmed, and not otherwise", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    const user = await openSheet();
    await screen.findAllByRole("listitem");

    await user.click(screen.getByRole("button", { name: "Remove Amy Ramp" }));
    expect(confirm).toHaveBeenCalledWith("Remove Amy Ramp from Alpha?");
    expect(removeMemberAction).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: "Remove Amy Ramp" }));
    await waitFor(() => expect(removeMemberAction).toHaveBeenCalledWith("t-1", "m-amy"));
  });

  it("shows why an action failed", async () => {
    addMemberAction.mockResolvedValue({ ok: false, error: "Couldn't add the member. Try again." });
    const user = await openSheet();
    await screen.findAllByRole("listitem");
    await user.selectOptions(screen.getByLabelText("Employee to add"), "u-bo");
    await user.click(screen.getByRole("button", { name: "+ Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't add the member. Try again.",
    );
  });

  it("without the staff list, still lists and says who can add", async () => {
    await openSheet(null);
    expect(await screen.findAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByLabelText("Employee to add")).toBeNull();
    expect(screen.getByText("Only an Executive Admin can add members.")).toBeInTheDocument();
  });
});
