import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DutyPeriodSummary } from "@/lib/api/types";

const amendDutyAction = vi.fn();
vi.mock("@/app/(app)/time-clock/actions", () => ({
  amendDutyAction: (...args: unknown[]) => amendDutyAction(...args),
}));

import { CorrectDuty } from "./correct-duty";

/**
 * Correcting a duty period by hand (client bug reports 8/28, 9/17, and
 * 9/27: "We also simply need a scrolling wheel with date and time").
 *
 * The assertions that earn their place are about what gets sent: an
 * untouched field must not be resubmitted as an amendment, a correction
 * must not go without a reason, and nothing can be set in the future.
 * They compare instants rather than wall-clock strings, so they hold in
 * any time zone.
 */

// Local noon, 10 Sep: the wheels work in local time.
const NOW = new Date(2026, 8, 10, 12, 0);
const IN = new Date(2026, 8, 10, 6, 0);

function period(over: Partial<DutyPeriodSummary> = {}): DutyPeriodSummary {
  return {
    id: "d-1",
    clock_in_at: IN.toISOString(),
    clock_out_at: null,
    elapsed_hours: 6,
    is_open: true,
    rest_acknowledged: true,
    ...over,
  } as DutyPeriodSummary;
}

function openForm(p = period(), triggerLabel?: string) {
  render(<CorrectDuty period={p} triggerLabel={triggerLabel} />);
  fireEvent.click(screen.getByRole("button", { name: triggerLabel ?? "Correct" }));
}

function wheel(name: string) {
  return screen.getByRole("listbox", { name });
}

function selected(name: string) {
  return within(wheel(name)).getByRole("option", { selected: true }).textContent;
}

function giveReason() {
  fireEvent.change(screen.getByRole("textbox", { name: /Why/ }), {
    target: { value: "Clocked in late, started at 05:00" },
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  amendDutyAction.mockReset();
  amendDutyAction.mockResolvedValue({ status: "ok", message: "Corrected." });
});
afterEach(() => vi.useRealTimers());

describe("before it is opened", () => {
  it("is a single link, not a form", () => {
    // A form open by default invites hand-editing as the normal route.
    render(<CorrectDuty period={period()} triggerLabel="Adjust today's duty times" />);
    expect(
      screen.getByRole("button", { name: "Adjust today's duty times" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Correct duty times" })).toBeNull();
  });
});

describe("the form", () => {
  it("offers the day and the time as scrolling wheels", () => {
    openForm();
    for (const part of ["day", "hour", "minute"]) {
      expect(wheel(`Duty in: ${part}`)).toBeInTheDocument();
    }
    expect(screen.queryByDisplayValue(/T\d\d:/)).toBeNull(); // no datetime-local
  });

  it("starts on the period's own times", () => {
    openForm();
    expect(selected("Duty in: day")).toBe("Today");
    expect(selected("Duty in: hour")).toBe("06");
    expect(selected("Duty in: minute")).toBe("00");
  });

  it("does not offer a duty-out time on a day still open, until asked", () => {
    openForm();
    expect(screen.queryByRole("listbox", { name: "Duty out: hour" })).toBeNull();
    expect(screen.getByText("Still on duty.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add a duty-out time" }));
    expect(selected("Duty out: hour")).toBe("12");
  });

  it("shows both on a closed period", () => {
    openForm(
      period({
        clock_out_at: new Date(2026, 8, 9, 22, 30).toISOString(),
        clock_in_at: new Date(2026, 8, 9, 8, 0).toISOString(),
        is_open: false,
      }),
    );
    expect(selected("Duty in: day")).toBe("Yesterday");
    expect(selected("Duty out: hour")).toBe("22");
    expect(selected("Duty out: minute")).toBe("30");
  });

  it("says the original is kept", () => {
    openForm();
    expect(
      screen.getByText("The original times and your reason are kept with the record."),
    ).toBeInTheDocument();
  });
});

describe("what gets sent", () => {
  it("will not submit without a reason", () => {
    openForm();
    expect(screen.getByRole("button", { name: "Save correction" })).toBeDisabled();
  });

  it("sends only the time that changed, as an instant", async () => {
    openForm();
    fireEvent.keyDown(wheel("Duty in: hour"), { key: "ArrowUp" });
    giveReason();
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    await waitFor(() => expect(amendDutyAction).toHaveBeenCalled());
    const [id, clockIn, clockOut, reason] = amendDutyAction.mock.calls[0];
    expect(id).toBe("d-1");
    expect(new Date(clockIn).getTime()).toBe(IN.getTime() - 3600_000);
    expect(clockOut).toBeNull();
    expect(reason).toBe("Clocked in late, started at 05:00");
  });

  it("can close a day the pilot forgot to clock out of", async () => {
    openForm();
    fireEvent.click(screen.getByRole("button", { name: "Add a duty-out time" }));
    fireEvent.keyDown(wheel("Duty out: hour"), { key: "PageUp" });
    giveReason();
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    await waitFor(() => expect(amendDutyAction).toHaveBeenCalled());
    const [, clockIn, clockOut] = amendDutyAction.mock.calls[0];
    expect(clockIn).toBeNull();
    expect(new Date(clockOut).getTime()).toBe(NOW.getTime() - 5 * 3600_000);
  });

  it("never sets a time in the future", () => {
    openForm();
    fireEvent.click(screen.getByRole("button", { name: "Add a duty-out time" }));
    fireEvent.keyDown(wheel("Duty out: hour"), { key: "End" });
    expect(selected("Duty out: hour")).toBe("12");
  });
});

describe("when the server refuses", () => {
  it("shows the reason and keeps the form open", async () => {
    amendDutyAction.mockResolvedValue({
      status: "error",
      message: "That overlaps another duty period.",
    });
    openForm();
    fireEvent.keyDown(wheel("Duty in: minute"), { key: "ArrowUp" });
    giveReason();
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That overlaps another duty period.",
    );
    expect(screen.getByRole("form", { name: "Correct duty times" })).toBeInTheDocument();
  });
});

describe("when it works", () => {
  it("closes the form and confirms", async () => {
    openForm();
    fireEvent.keyDown(wheel("Duty in: minute"), { key: "ArrowUp" });
    giveReason();
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Corrected.");
    expect(screen.queryByRole("form", { name: "Correct duty times" })).toBeNull();
  });
});
