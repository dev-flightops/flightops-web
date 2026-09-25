import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const clockInAction = vi.fn(async () => ({ ok: true }));
const clockOutAction = vi.fn(async () => ({ ok: true }));
vi.mock("./actions", () => ({
  clockInAction: () => clockInAction(),
  clockOutAction: () => clockOutAction(),
}));

import type { CurrentDutyResponse } from "@/lib/api/types";

import { DutyClockButton } from "./duty-clock-button";

const onDuty = (): CurrentDutyResponse =>
  ({
    open: {
      id: "d-1",
      clock_in_at: new Date(Date.now() - 12 * 3_600_000).toISOString(),
      clock_out_at: null,
      elapsed_hours: 12.5,
      is_open: true,
      rest_acknowledged: true,
    },
    last_closed: null,
    warnings: [],
  }) as CurrentDutyResponse;

const offDuty = (): CurrentDutyResponse =>
  ({ open: null, last_closed: null, warnings: [] }) as CurrentDutyResponse;

/**
 * Client bug report, 24 September:
 *
 *   Duty out function: You can accidently close out your duty day
 */
describe("the duty hero button", () => {
  beforeEach(() => {
    clockInAction.mockClear();
    clockOutAction.mockClear();
  });

  it("does not close the period on the first press", async () => {
    const user = userEvent.setup();
    render(<DutyClockButton initial={onDuty()} />);
    await user.click(screen.getByRole("button", { name: /DUTY OUT/i }));
    expect(clockOutAction).not.toHaveBeenCalled();
  });

  it("shows the elapsed time and the consequence", async () => {
    // "Are you sure?" on its own tells a pilot nothing they did not
    // already know. These two facts are what make the answer different.
    const user = userEvent.setup();
    render(<DutyClockButton initial={onDuty()} />);
    await user.click(screen.getByRole("button", { name: /DUTY OUT/i }));
    expect(screen.getByText(/CLOSE THIS DUTY PERIOD\?/i)).toBeInTheDocument();
    expect(screen.getByText(/12h 30m/)).toBeInTheDocument();
    expect(screen.getByText(/starts a new duty period/i)).toBeInTheDocument();
  });

  it("closes it when confirmed", async () => {
    const user = userEvent.setup();
    render(<DutyClockButton initial={onDuty()} />);
    await user.click(screen.getByRole("button", { name: /DUTY OUT/i }));
    await user.click(
      screen.getByRole("button", { name: /Close duty period/i }),
    );
    expect(clockOutAction).toHaveBeenCalledTimes(1);
  });

  it("keeps the period open when the pilot backs out", async () => {
    const user = userEvent.setup();
    render(<DutyClockButton initial={onDuty()} />);
    await user.click(screen.getByRole("button", { name: /DUTY OUT/i }));
    await user.click(screen.getByRole("button", { name: /Keep working/i }));
    expect(clockOutAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /DUTY OUT/i })).toBeInTheDocument();
  });

  it("disarms on Escape", async () => {
    const user = userEvent.setup();
    render(<DutyClockButton initial={onDuty()} />);
    await user.click(screen.getByRole("button", { name: /DUTY OUT/i }));
    await user.keyboard("{Escape}");
    expect(clockOutAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /DUTY OUT/i })).toBeInTheDocument();
  });

  it("no longer promises a single tap closes it", async () => {
    // The sub-label said "tap to close", which was both the behaviour
    // and the invitation.
    render(<DutyClockButton initial={onDuty()} />);
    expect(screen.getByText(/tap, then confirm/i)).toBeInTheDocument();
    expect(screen.queryByText(/tap to close/i)).not.toBeInTheDocument();
  });

  it("still clocks in on a single press", async () => {
    const user = userEvent.setup();
    render(<DutyClockButton initial={offDuty()} />);
    await user.click(screen.getByRole("button", { name: /DUTY IN/i }));
    expect(clockInAction).toHaveBeenCalledTimes(1);
  });
});
