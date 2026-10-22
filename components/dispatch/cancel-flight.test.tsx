import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cancelScheduledFlightAction, refresh } = vi.hoisted(() => ({
  cancelScheduledFlightAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/(app)/dispatch/[flightId]/actions", () => ({ cancelScheduledFlightAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { CancelFlight } from "./cancel-flight";

describe("CancelFlight (#106)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cancels the scheduled flight, with or without a reason", async () => {
    cancelScheduledFlightAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<CancelFlight flightId="f-1" flightNumber="GV1111" />);
    await user.click(screen.getByRole("button", { name: "Cancel Flight" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(/stays on record as cancelled/);
    await user.type(screen.getByLabelText("Reason (optional)"), "Planned twice");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel Flight" }));
    expect(cancelScheduledFlightAction).toHaveBeenCalledWith("f-1", "Planned twice");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says why when ops refuses", async () => {
    cancelScheduledFlightAction.mockResolvedValue({
      ok: false,
      error: "This flight has departed, so its release can no longer be taken back.",
    });
    const user = userEvent.setup();
    render(<CancelFlight flightId="f-1" flightNumber="GV1111" />);
    await user.click(screen.getByRole("button", { name: "Cancel Flight" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel Flight" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/has departed/);
    expect(refresh).not.toHaveBeenCalled();
  });
});
