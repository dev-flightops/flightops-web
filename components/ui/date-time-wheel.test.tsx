import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

import { DateTimeWheel } from "./date-time-wheel";

// Local times throughout: the wheels show the viewer's clock.
const LATEST = new Date(2026, 8, 27, 14, 30);
const EARLIEST = new Date(2026, 8, 20, 0, 0);
const VALUE = new Date(2026, 8, 26, 9, 15);

function setup(value = VALUE) {
  const onChange = vi.fn();
  const view = render(
    <DateTimeWheel
      label="Duty in"
      value={value}
      onChange={onChange}
      earliest={EARLIEST}
      latest={LATEST}
    />,
  );
  return { onChange, ...view };
}

const wheel = (part: string) => screen.getByRole("listbox", { name: `Duty in: ${part}` });
const picked = (part: string) =>
  within(wheel(part)).getByRole("option", { selected: true }).textContent;

afterEach(() => vi.useRealTimers());

describe("DateTimeWheel", () => {
  it("shows the value on three wheels, days named for the reader", () => {
    setup();
    expect(picked("day")).toBe("Yesterday");
    expect(picked("hour")).toBe("09");
    expect(picked("minute")).toBe("15");
    const days = within(wheel("day")).getAllByRole("option").map((o) => o.textContent);
    expect(days.at(-1)).toBe("Today");
    expect(days).toHaveLength(8); // 20th to 27th
  });

  it("turns with the arrow keys, five at a time with Page keys", () => {
    const { onChange } = setup();
    fireEvent.keyDown(wheel("hour"), { key: "ArrowDown" });
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 8, 26, 10, 15));
    fireEvent.keyDown(wheel("minute"), { key: "PageUp" });
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 8, 26, 9, 10));
    fireEvent.keyDown(wheel("day"), { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 8, 20, 9, 15));
  });

  it("picks a row that is clicked", () => {
    const { onChange } = setup();
    fireEvent.click(within(wheel("hour")).getByRole("option", { name: "17" }));
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 8, 26, 17, 15));
  });

  it("settles on the row a scroll stops at", () => {
    vi.useFakeTimers();
    const { onChange } = setup();
    const minutes = wheel("minute");
    minutes.scrollTop = 20 * 32; // row 20
    fireEvent.scroll(minutes);
    expect(onChange).not.toHaveBeenCalled(); // still moving
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 8, 26, 9, 20));
  });

  it("will not go past the latest time", () => {
    const { onChange } = setup(new Date(2026, 8, 27, 9, 15));
    fireEvent.keyDown(wheel("hour"), { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(LATEST);
  });

  it("has no a11y violations", async () => {
    const { container } = setup();
    await expectNoA11yViolations(container);
  });
});
