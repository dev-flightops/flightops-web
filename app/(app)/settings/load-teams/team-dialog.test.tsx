import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";
import type { LoadTeamResponse } from "@/lib/api/types";

const { saveTeamAction } = vi.hoisted(() => ({ saveTeamAction: vi.fn() }));
vi.mock("./actions", () => ({ saveTeamAction }));

import { TeamDialog, type PersonOption, type StationOption } from "./team-dialog";

const STATIONS: StationOption[] = [
  { icao: "PABE", name: "Bethel" },
  { icao: "PANC", name: "Anchorage" },
];
const PEOPLE: PersonOption[] = [
  { id: "u-dana", name: "Dana Ruiz", roles: "Ground Ops" },
  { id: "u-owen", name: "Owen Staley", roles: "Ground Ops, Dispatcher" },
];
const TEAM: LoadTeamResponse = {
  id: "t-1",
  team_name: "Alpha",
  base_icao: "PANC",
  team_lead: { id: "u-dana", full_name: "Dana Ruiz", email: "d@x.test" },
  color_code: "#abc",
  is_active: true,
  notes: "Weekdays",
  member_count: 3,
};

function sent(): Record<string, FormDataEntryValue> {
  return Object.fromEntries((saveTeamAction.mock.calls[0][0] as FormData).entries());
}

async function openDialog(props: Partial<Parameters<typeof TeamDialog>[0]> = {}) {
  const user = userEvent.setup();
  render(
    <TeamDialog
      stations={STATIONS}
      people={PEOPLE}
      trigger="+ Add Team"
      triggerClassName=""
      {...props}
    />,
  );
  await user.click(screen.getByRole("button", { name: props.triggerLabel ?? String(props.trigger ?? "+ Add Team") }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  saveTeamAction.mockResolvedValue({ status: "ok" });
});

describe("TeamDialog — add", () => {
  it("creates a team at the base it was opened from, then closes", async () => {
    const user = await openDialog({ defaultBase: "PANC", trigger: "+ Add Team at PANC" });
    expect(screen.getByRole("heading", { name: "Add Team" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Base/)).toHaveValue("PANC");

    await user.type(screen.getByLabelText(/Team Name/), "Night Shift");
    await user.selectOptions(screen.getByLabelText("Team Lead"), "u-owen");
    await user.click(screen.getByRole("button", { name: "Save Team" }));

    await waitFor(() => expect(saveTeamAction).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({
      team_name: "Night Shift",
      base_icao: "PANC",
      team_lead_user_id: "u-owen",
      color_code: "#60a5fa",
      notes: "",
    });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Add Team" })).toBeNull(),
    );
  });

  it("makes you pick a base rather than defaulting to one", async () => {
    await openDialog();
    const base = screen.getByLabelText(/Base/);
    expect(base).toHaveValue("");
    expect(screen.getByRole("option", { name: "Pick a base…" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "PANC — Anchorage" })).toBeInTheDocument();
  });

  it("keeps the form open and marks the field the server refused", async () => {
    saveTeamAction.mockResolvedValue({
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: { team_name: "PANC already has a team called “Alpha”." },
    });
    const user = await openDialog({ defaultBase: "PANC", trigger: "+ Add Team at PANC" });
    await user.type(screen.getByLabelText(/Team Name/), "Alpha");
    await user.click(screen.getByRole("button", { name: "Save Team" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Check the highlighted fields.");
    const name = screen.getByLabelText(/Team Name/);
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("PANC already has a team called “Alpha”.");
    expect(screen.getByRole("heading", { name: "Add Team" })).toBeInTheDocument();
  });
});

describe("TeamDialog — edit", () => {
  it("starts from the team as it is", async () => {
    await openDialog({ team: TEAM, trigger: "Edit", triggerLabel: "Edit Alpha" });
    expect(screen.getByRole("heading", { name: "Edit Team" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Team Name/)).toHaveValue("Alpha");
    expect(screen.getByLabelText(/Base/)).toHaveValue("PANC");
    expect(screen.getByLabelText("Team Lead")).toHaveValue("u-dana");
    expect(screen.getByLabelText("Team Color")).toHaveValue("#aabbcc");
    expect(screen.getByLabelText("Notes")).toHaveValue("Weekdays");
  });

  it("keeps a lead who isn't in the staff list, instead of clearing them", async () => {
    const user = await openDialog({
      team: { ...TEAM, team_lead: { id: "u-gone", full_name: "Former Lead", email: "f@x.test" } },
      trigger: "Edit",
      triggerLabel: "Edit Alpha",
    });
    expect(screen.getByLabelText("Team Lead")).toHaveValue("u-gone");
    await user.click(screen.getByRole("button", { name: "Save Team" }));
    await waitFor(() => expect(saveTeamAction).toHaveBeenCalled());
    expect(sent()).toMatchObject({ team_id: "t-1", team_lead_user_id: "u-gone" });
  });

  it("without the staff list, says the lead can't be changed and sends none", async () => {
    const user = await openDialog({
      team: TEAM,
      people: null,
      trigger: "Edit",
      triggerLabel: "Edit Alpha",
    });
    expect(screen.queryByLabelText("Team Lead")).toBeNull();
    expect(
      screen.getByText("Dana Ruiz. The staff list couldn’t be loaded, so the lead can’t be changed right now."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save Team" }));
    await waitFor(() => expect(saveTeamAction).toHaveBeenCalled());
    expect(sent()).not.toHaveProperty("team_lead_user_id");
  });

  it("has no a11y violations", async () => {
    await openDialog({ team: TEAM, trigger: "Edit", triggerLabel: "Edit Alpha" });
    await expectNoA11yViolations(document.body);
  });
});
