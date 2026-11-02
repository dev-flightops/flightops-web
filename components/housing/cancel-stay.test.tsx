import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cancel, refresh } = vi.hoisted(() => ({ cancel: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/(app)/housing/actions", () => ({ cancelHousingBookingAction: cancel }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import { CancelStay } from "./cancel-stay";

beforeEach(() => { cancel.mockReset(); refresh.mockReset(); });

function show() {
  render(<CancelStay bookingId="stay" unitId="house" employee="Demo Pilot" />);
  fireEvent.click(screen.getByRole("button", { name: "Cancel stay" }));
  return screen.getByRole("dialog");
}

describe("housing stay cancellation", () => {
  it("keeps the stay unless confirmation is submitted", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Keep stay" }));
    expect(cancel).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("prevents repeat clicks while cancelling and refreshes occupancy after success", async () => {
    let finish!: (value: unknown) => void;
    cancel.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const dialog = show();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel stay" }));
    expect(screen.getByRole("button", { name: "Cancelling…" })).toBeDisabled();
    expect(cancel).toHaveBeenCalledWith("stay", "house");
    finish({ ok: true });
    await screen.findByRole("button", { name: "Cancel stay" });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows a refusal and leaves the stay visible", async () => {
    cancel.mockResolvedValue({ ok: false, error: "Permission denied" });
    const dialog = show();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel stay" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Permission denied");
    expect(refresh).not.toHaveBeenCalled();
  });
});
