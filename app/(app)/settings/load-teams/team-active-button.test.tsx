import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { setTeamActiveAction } = vi.hoisted(() => ({ setTeamActiveAction: vi.fn() }));
vi.mock("./actions", () => ({ setTeamActiveAction }));

import { TeamActiveButton } from "./team-active-button";

beforeEach(() => {
  vi.clearAllMocks();
  setTeamActiveAction.mockResolvedValue({ ok: true });
});
afterEach(() => vi.restoreAllMocks());

describe("TeamActiveButton", () => {
  it("deactivates only after the confirm, which says what it does", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    const user = userEvent.setup();
    render(<TeamActiveButton teamId="t-1" teamName="Alpha" active />);

    await user.click(screen.getByRole("button", { name: "Deactivate Alpha" }));
    expect(confirm.mock.calls[0][0]).toMatch(
      /^Deactivate Alpha\? Ramp Ops and the dispatch packet stop offering it; flights already on it keep it\./,
    );
    expect(setTeamActiveAction).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: "Deactivate Alpha" }));
    await waitFor(() => expect(setTeamActiveAction).toHaveBeenCalledWith("t-1", false));
  });

  it("reactivates without asking", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const user = userEvent.setup();
    render(<TeamActiveButton teamId="t-1" teamName="Alpha" active={false} />);
    await user.click(screen.getByRole("button", { name: "Reactivate Alpha" }));
    await waitFor(() => expect(setTeamActiveAction).toHaveBeenCalledWith("t-1", true));
    expect(confirm).not.toHaveBeenCalled();
  });

  it("shows why it failed", async () => {
    setTeamActiveAction.mockResolvedValue({ ok: false, error: "Couldn't reactivate the team. Try again." });
    const user = userEvent.setup();
    render(<TeamActiveButton teamId="t-1" teamName="Alpha" active={false} />);
    await user.click(screen.getByRole("button", { name: "Reactivate Alpha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't reactivate the team. Try again.",
    );
  });
});
