import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { PeriodControls } from "./period-controls";

/**
 * The month arithmetic is the part worth testing. Adding a month to a
 * Date is the classic trap — 31 January plus one month lands on 3
 * March — and no accounting period skips February.
 */

beforeEach(() => push.mockReset());

describe("stepping the period", () => {
  it("shows the month being read", () => {
    render(<PeriodControls year={2026} month={8} />);
    expect(screen.getByLabelText(/accounting period/i)).toHaveValue("2026-08");
  });

  it("rolls December into the next January", async () => {
    render(<PeriodControls year={2026} month={12} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /next month/i }));
    expect(push).toHaveBeenCalledWith("/accounting?year=2027&month=1");
  });

  it("rolls January back into the previous December", async () => {
    render(<PeriodControls year={2026} month={1} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /previous month/i }));
    expect(push).toHaveBeenCalledWith("/accounting?year=2025&month=12");
  });

  it("never produces a thirteenth month", async () => {
    render(<PeriodControls year={2026} month={12} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /next month/i }));
    const url = new URL(push.mock.calls[0][0] as string, "http://x");
    const m = Number(url.searchParams.get("month"));
    expect(m).toBeGreaterThanOrEqual(1);
    expect(m).toBeLessThanOrEqual(12);
  });

  it("goes to a month picked from the field", () => {
    render(<PeriodControls year={2026} month={8} />);
    fireEvent.change(screen.getByLabelText(/accounting period/i), {
      target: { value: "2026-02" },
    });
    expect(push).toHaveBeenCalledWith("/accounting?year=2026&month=2");
  });

  it("ignores a cleared field", () => {
    render(<PeriodControls year={2026} month={8} />);
    fireEvent.change(screen.getByLabelText(/accounting period/i), {
      target: { value: "" },
    });
    expect(push).not.toHaveBeenCalled();
  });
});
