import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentDutyResponse } from "@/lib/api/types";

import { TopBarClockButton } from "./top-bar-clock-button";

const onDuty = (): CurrentDutyResponse =>
  ({
    open: {
      id: "d-1",
      clock_in_at: new Date(Date.now() - 12 * 3_600_000).toISOString(),
      clock_out_at: null,
      elapsed_hours: 12,
      is_open: true,
      rest_acknowledged: true,
    },
    last_closed: null,
    warnings: [],
  }) as CurrentDutyResponse;

const offDuty = (): CurrentDutyResponse =>
  ({ open: null, last_closed: null, warnings: [] }) as CurrentDutyResponse;

const clockIn = vi.fn(async () => ({ ok: true }) as never);
const clockOut = vi.fn(async () => ({ ok: true }) as never);

function pill(duty: CurrentDutyResponse) {
  render(
    <TopBarClockButton initial={duty} clockIn={clockIn} clockOut={clockOut} />,
  );
}

/**
 * Client bug report, 24 September:
 *
 *   Duty out function: You can accidently close out your duty day
 *
 * This pill is in the header of every page and fired on one click.
 */
describe("the header duty pill", () => {
  beforeEach(() => {
    clockIn.mockClear();
    clockOut.mockClear();
  });

  it("does not clock out on the first press", async () => {
    const user = userEvent.setup();
    pill(onDuty());
    await user.click(screen.getByRole("button", { name: /Clock Out/i }));
    expect(clockOut).not.toHaveBeenCalled();
  });

  it("says what the next press will do", async () => {
    const user = userEvent.setup();
    pill(onDuty());
    await user.click(screen.getByRole("button", { name: /Clock Out/i }));
    expect(
      screen.getByRole("button", { name: /Confirm duty out/i }),
    ).toBeInTheDocument();
  });

  it("warns that clocking back in will not resume this period", async () => {
    // The fact that makes an accidental close expensive rather than
    // untidy, and the reason a bare "are you sure?" would not do.
    const user = userEvent.setup();
    pill(onDuty());
    await user.click(screen.getByRole("button", { name: /Clock Out/i }));
    expect(
      screen.getByText(/starts a new duty period/i),
    ).toBeInTheDocument();
  });

  it("clocks out on the second press", async () => {
    const user = userEvent.setup();
    pill(onDuty());
    await user.click(screen.getByRole("button", { name: /Clock Out/i }));
    await user.click(
      screen.getByRole("button", { name: /Confirm duty out/i }),
    );
    expect(clockOut).toHaveBeenCalledTimes(1);
  });

  it("disarms on Escape", async () => {
    const user = userEvent.setup();
    pill(onDuty());
    await user.click(screen.getByRole("button", { name: /Clock Out/i }));
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("button", { name: /Clock Out/i }),
    ).toBeInTheDocument();
    expect(clockOut).not.toHaveBeenCalled();
  });

  it("disarms when the pilot clicks elsewhere", async () => {
    // An armed control left behind should not be waiting to fire the
    // next time somebody's mouse passes over it.
    const user = userEvent.setup();
    pill(onDuty());
    await user.click(screen.getByRole("button", { name: /Clock Out/i }));
    await user.click(document.body);
    expect(
      screen.getByRole("button", { name: /Clock Out/i }),
    ).toBeInTheDocument();
    expect(clockOut).not.toHaveBeenCalled();
  });

  it("still clocks in on a single press", async () => {
    // Not the destructive direction. Friction on starting a duty day
    // would be friction on the honest path.
    const user = userEvent.setup();
    pill(offDuty());
    await user.click(screen.getByRole("button", { name: /Clock In/i }));
    expect(clockIn).toHaveBeenCalledTimes(1);
  });
});
