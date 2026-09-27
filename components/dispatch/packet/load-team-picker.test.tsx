import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { assignFlightAction, unassignFlightAction } = vi.hoisted(() => ({
  assignFlightAction: vi.fn(),
  unassignFlightAction: vi.fn(),
}));
vi.mock("@/components/load-teams/assign-actions", () => ({
  assignFlightAction,
  unassignFlightAction,
}));

import { LoadTeamPicker, type LoadTeamCard } from "./load-team-picker";

const FLIGHT_ID = "11111111-1111-4111-8111-111111111111";
const ALPHA: LoadTeamCard = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Alpha",
  color: "#2563eb",
  detail: "Dana Ruiz · 4 members",
  assigned: false,
};
const BRAVO: LoadTeamCard = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Bravo",
  color: "#16a34a",
  detail: "No lead · 1 member",
  assigned: false,
};

function renderPicker(cards: LoadTeamCard[], lockedNote: string | null = null) {
  return render(
    <LoadTeamPicker
      flightId={FLIGHT_ID}
      flightNumber="PGR900"
      cards={cards}
      lockedNote={lockedNote}
    />,
  );
}

const sent = (fn: ReturnType<typeof vi.fn>) =>
  Object.fromEntries((fn.mock.calls[0][1] as FormData).entries());

beforeEach(() => {
  vi.clearAllMocks();
  assignFlightAction.mockResolvedValue({ status: "ok" });
  unassignFlightAction.mockResolvedValue({ status: "ok" });
});

describe("LoadTeamPicker", () => {
  it("assigns the clicked team to the flight", async () => {
    renderPicker([ALPHA, BRAVO]);
    await userEvent.click(screen.getByRole("button", { name: /^Assign Bravo/ }));
    await waitFor(() => expect(assignFlightAction).toHaveBeenCalledTimes(1));
    expect(sent(assignFlightAction)).toEqual({
      flight_id: FLIGHT_ID,
      load_team_id: BRAVO.id,
    });
    expect(unassignFlightAction).not.toHaveBeenCalled();
  });

  it("clears the flight's team", async () => {
    renderPicker([{ ...ALPHA, assigned: true }, BRAVO]);
    await userEvent.click(
      screen.getByRole("button", { name: "Clear load team Alpha" }),
    );
    await waitFor(() => expect(unassignFlightAction).toHaveBeenCalledTimes(1));
    expect(sent(unassignFlightAction)).toMatchObject({ flight_id: FLIGHT_ID });
    expect(assignFlightAction).not.toHaveBeenCalled();
  });

  it("shows the latest action's error, and drops it once one succeeds", async () => {
    assignFlightAction.mockResolvedValueOnce({
      status: "error",
      message: "That load team is inactive — pick another team.",
    });
    renderPicker([{ ...ALPHA, assigned: true }, BRAVO]);
    await userEvent.click(screen.getByRole("button", { name: /^Assign Bravo/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That load team is inactive — pick another team.",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Clear load team Alpha" }),
    );
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("offers nothing to click on a locked flight", () => {
    renderPicker(
      [{ ...ALPHA, assigned: true }],
      "This flight is completed — its load team can't be changed.",
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(
      screen.getByText("This flight is completed — its load team can't be changed."),
    ).toBeInTheDocument();
  });
});
