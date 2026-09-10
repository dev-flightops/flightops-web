import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { DayPicker } from "./day-picker";

/**
 * Legacy's delay page shows today and only today. The dispatch packet
 * did the same, and it was the single biggest thing wrong with the
 * system when the client walked it on 9 September. Delay risk is most
 * useful before the day starts, so the day is a control here from the
 * outset.
 */

beforeEach(() => push.mockReset());

describe("the day control", () => {
  it("shows the day being viewed", () => {
    render(<DayPicker date="2026-09-09" />);
    expect(screen.getByLabelText(/flights date/i)).toHaveValue("2026-09-09");
  });

  it("steps forward one day", async () => {
    render(<DayPicker date="2026-09-09" />);
    await userEvent.setup().click(screen.getByRole("button", { name: /next day/i }));
    expect(push).toHaveBeenCalledWith("/ai/delay-alerts?date=2026-09-10");
  });

  it("steps back one day", async () => {
    render(<DayPicker date="2026-09-09" />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /previous day/i }));
    expect(push).toHaveBeenCalledWith("/ai/delay-alerts?date=2026-09-08");
  });

  it("steps in UTC, not the viewer's zone", async () => {
    // Local-time stepping is what made the fleet board's arrows skip
    // two days at a time west of Greenwich. Crossing a month boundary
    // from a date that is "yesterday" in US zones is where it shows.
    render(<DayPicker date="2026-03-01" />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /previous day/i }));
    expect(push).toHaveBeenCalledWith("/ai/delay-alerts?date=2026-02-28");
  });

  it("handles a leap day", async () => {
    render(<DayPicker date="2028-02-28" />);
    await userEvent.setup().click(screen.getByRole("button", { name: /next day/i }));
    expect(push).toHaveBeenCalledWith("/ai/delay-alerts?date=2028-02-29");
  });

  it("goes to a day picked from the field", () => {
    render(<DayPicker date="2026-09-09" />);
    fireEvent.change(screen.getByLabelText(/flights date/i), {
      target: { value: "2026-07-04" },
    });
    expect(push).toHaveBeenCalledWith("/ai/delay-alerts?date=2026-07-04");
  });

  it("ignores the field being cleared", () => {
    // An empty value would navigate to ?date= and silently fall back
    // to today, moving the reader off the day they were on.
    render(<DayPicker date="2026-09-09" />);
    fireEvent.change(screen.getByLabelText(/flights date/i), {
      target: { value: "" },
    });
    expect(push).not.toHaveBeenCalled();
  });
});
