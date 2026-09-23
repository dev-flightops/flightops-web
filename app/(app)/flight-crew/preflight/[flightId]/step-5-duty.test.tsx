import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

const clockInAction = vi.fn();
vi.mock("../../actions", () => ({
  clockInAction: (...args: unknown[]) => clockInAction(...args),
  clockOutAction: vi.fn(),
}));

vi.mock("./actions", () => ({ completeStepAction: vi.fn() }));

import type { CurrentDutyResponse } from "@/lib/api/types";

import { DutyInConfirmStep } from "./step-5-duty";

/**
 * Step 5 was a dead stop in the middle of the preflight.
 *
 * Walking the eight steps as a pilot on 23 Sep, it read:
 *
 *   NOT CLOCKED IN — Tap DUTY IN on the Flight Crew home page first,
 *   then refresh this page to continue.
 *
 * So the one step that blocks progress sent the pilot to a different
 * page and asked them to reload. Both halves were wrong by then: the
 * top bar's own Clock In works from this screen, and the step updates
 * itself when it succeeds. The stated reason in the docstring was that
 * duplicating the duty button needed "a separate refresh flow" —
 * router.refresh(), one line.
 */

const offDuty: CurrentDutyResponse = {
  open: null,
  last_closed: null,
  warnings: [],
  min_rest_hours: 9,
  max_duty_hours: 14,
} as unknown as CurrentDutyResponse;

const onDuty: CurrentDutyResponse = {
  open: {
    id: "d-1",
    clock_in_at: "2026-09-23T14:26:00Z",
    clock_out_at: null,
    elapsed_hours: 0.1,
    is_open: true,
  },
  last_closed: null,
  warnings: [],
  min_rest_hours: 9,
  max_duty_hours: 14,
} as unknown as CurrentDutyResponse;

beforeEach(() => {
  refresh.mockClear();
  clockInAction.mockReset();
  clockInAction.mockResolvedValue({ ok: true });
});

describe("clocking in from the step", () => {
  it("offers a duty-in button rather than sending the pilot away", async () => {
    render(<DutyInConfirmStep flightId="f-1" duty={offDuty} />);
    expect(
      screen.getByRole("button", { name: /duty in/i }),
    ).toBeInTheDocument();
  });

  it("no longer tells the pilot to go to another page and reload", () => {
    const { container } = render(
      <DutyInConfirmStep flightId="f-1" duty={offDuty} />,
    );
    expect(container.textContent).not.toMatch(/refresh this page/i);
    expect(container.textContent).not.toMatch(/Flight Crew home page/i);
  });

  it("says why a duty period is needed at all", () => {
    // Not just "you must" — the reason is the 135.267 limits, which is
    // what makes it worth blocking on.
    render(<DutyInConfirmStep flightId="f-1" duty={offDuty} />);
    expect(screen.getByText(/135\.267/)).toBeInTheDocument();
  });

  it("clocks in and refreshes so the step re-renders", async () => {
    // clockInAction revalidates /flight-crew, not this route, so the
    // refresh is what brings the open duty period back here. Without
    // it the pilot is back to reloading by hand.
    const user = userEvent.setup();
    render(<DutyInConfirmStep flightId="f-1" duty={offDuty} />);
    await user.click(screen.getByRole("button", { name: /duty in/i }));
    expect(clockInAction).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("surfaces a refusal instead of silently doing nothing", async () => {
    clockInAction.mockResolvedValue({
      ok: false,
      error: "Rest period not met.",
    });
    const user = userEvent.setup();
    render(<DutyInConfirmStep flightId="f-1" duty={offDuty} />);
    await user.click(screen.getByRole("button", { name: /duty in/i }));
    expect(await screen.findByText(/Rest period not met/)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("still says something when a failure carries no message", async () => {
    // DutyActionResult.error is optional; a blank alert is worse than
    // a generic one.
    clockInAction.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<DutyInConfirmStep flightId="f-1" duty={offDuty} />);
    await user.click(screen.getByRole("button", { name: /duty in/i }));
    expect(await screen.findByText(/couldn't clock in/i)).toBeInTheDocument();
  });

  it("shows no duty-in button once a period is open", () => {
    render(<DutyInConfirmStep flightId="f-1" duty={onDuty} />);
    expect(
      screen.queryByRole("button", { name: /^duty in$/i }),
    ).not.toBeInTheDocument();
  });
});
