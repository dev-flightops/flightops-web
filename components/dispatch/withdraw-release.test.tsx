import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pullBackReleaseAction, cancelReleasedFlightAction, flightWalkUpsAction, refresh } = vi.hoisted(() => ({
  pullBackReleaseAction: vi.fn(),
  cancelReleasedFlightAction: vi.fn(),
  flightWalkUpsAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/(app)/dispatch/[flightId]/actions", () => ({
  pullBackReleaseAction,
  cancelReleasedFlightAction,
  flightWalkUpsAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { WithdrawRelease } from "./withdraw-release";

beforeEach(() => {
  vi.clearAllMocks();
  flightWalkUpsAction.mockResolvedValue([]);
});

describe("WithdrawRelease (#90)", () => {
  it("names the passengers with no booking when cancelling, not when pulling back (#174)", async () => {
    flightWalkUpsAction.mockResolvedValue(["Wally Walkup"]);
    const user = userEvent.setup();
    render(<WithdrawRelease flightId="f-1" flightNumber="PGR701" />);
    await user.click(screen.getByRole("button", { name: "Pull back release" }));
    expect(flightWalkUpsAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Cancel flight" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Wally Walkup has no booking, added on the manifest, so doesn't go back to Awaiting a flight.",
    );
  });

  it("pulls the release back only once a reason is given", async () => {
    pullBackReleaseAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<WithdrawRelease flightId="f-1" flightNumber="PGR701" />);
    await user.click(screen.getByRole("button", { name: "Pull back release" }));
    expect(screen.getByText("Pull back the release · PGR701")).toBeInTheDocument();

    const confirm = screen.getAllByRole("button", { name: "Pull back release" }).at(-1)!;
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText("Reason"), "PABE went below minimums");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() =>
      expect(pullBackReleaseAction).toHaveBeenCalledWith("f-1", "PABE went below minimums"),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(cancelReleasedFlightAction).not.toHaveBeenCalled();
  });

  it("cancels the released flight with its reason, and shows a refusal", async () => {
    cancelReleasedFlightAction.mockResolvedValue({
      ok: false,
      error: "This flight has departed, so its release can no longer be taken back.",
    });
    const user = userEvent.setup();
    render(<WithdrawRelease flightId="f-1" flightNumber="PGR701" />);
    await user.click(screen.getByRole("button", { name: "Cancel flight" }));
    expect(screen.getByText("Cancel the released flight · PGR701")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Reason"), "Customer cancelled");
    await user.click(screen.getAllByRole("button", { name: "Cancel flight" }).at(-1)!);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This flight has departed, so its release can no longer be taken back.",
    );
    expect(cancelReleasedFlightAction).toHaveBeenCalledWith("f-1", "Customer cancelled");
    expect(refresh).not.toHaveBeenCalled();
  });
});
