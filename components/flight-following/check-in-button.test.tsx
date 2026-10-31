import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const check = vi.fn();
const checkIn = vi.fn();
vi.mock("./check-in-action", () => ({
  departureCheckAction: (...args: unknown[]) => check(...args),
  checkInFlightAction: (...args: unknown[]) => checkIn(...args),
}));

import { CheckInButton } from "./check-in-button";

beforeEach(() => {
  check.mockReset();
  checkIn.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
});

describe("Mark Departed / Mark Arrived (#155)", () => {
  it("asks in the page, not a browser pop-up, and lists what the departure will be flagged for", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    check.mockResolvedValue([
      { code: "pic_off_duty", message: "Tomas Eklund wasn't clocked in." },
      { code: "early_departure", message: "Left 6 h 00 min before its ETD." },
    ]);
    const user = userEvent.setup();
    render(<CheckInButton flightId="f-1" flightNumber="TST901" event="depart" />);
    await user.click(screen.getByRole("button", { name: "Mark Departed" }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(await screen.findByText("Tomas Eklund wasn't clocked in.")).toBeInTheDocument();
    expect(screen.getByText("Left 6 h 00 min before its ETD.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Record it, flagged" }));
    expect(checkIn).toHaveBeenCalledWith("f-1", "depart", true);
    expect(refresh).toHaveBeenCalled();
  });

  it("says so when there is nothing to flag", async () => {
    check.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<CheckInButton flightId="f-1" event="depart" />);
    await user.click(screen.getByRole("button", { name: "Mark Departed" }));
    expect(await screen.findByText(/Nothing to flag/)).toBeInTheDocument();
  });

  it("shows why an arrival was refused", async () => {
    checkIn.mockResolvedValue({ ok: false, error: "An arrival within 5 minutes of the departure can't be right. Check the times." });
    const user = userEvent.setup();
    render(<CheckInButton flightId="f-1" event="arrive" />);
    await user.click(screen.getByRole("button", { name: "Mark Arrived" }));
    await user.click(screen.getByRole("button", { name: "Mark Arrived" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/within 5 minutes/);
  });
});
