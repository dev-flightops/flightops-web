import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DutyPeriodSummary } from "@/lib/api/types";

const amendDutyAction = vi.fn();
vi.mock("./actions", () => ({
  amendDutyAction: (...args: unknown[]) => amendDutyAction(...args),
}));

import { CorrectDuty } from "./correct-duty";

/**
 * Correcting a duty period by hand (client bug report 8/28).
 *
 * The assertions that earn their place are about what gets sent: an
 * untouched field must not be resubmitted as an amendment, and a
 * correction must not go without a reason — this is an edit to the
 * record the 135.267 limits are computed from.
 */

function period(over: Partial<DutyPeriodSummary> = {}): DutyPeriodSummary {
  return {
    id: "d-1",
    clock_in_at: "2026-09-09T06:00:00.000Z",
    clock_out_at: null,
    elapsed_hours: 20,
    is_open: true,
    rest_acknowledged: true,
    ...over,
  } as DutyPeriodSummary;
}

function openForm(p = period()) {
  render(<CorrectDuty period={p} />);
  fireEvent.click(screen.getByRole("button", { name: "Correct" }));
}

beforeEach(() => {
  amendDutyAction.mockReset();
  amendDutyAction.mockResolvedValue({ status: "ok", message: "Corrected." });
});

describe("before it is opened", () => {
  it("is a single link, not a form", () => {
    // A form open by default invites hand-editing as the normal route.
    // The clock is the normal route.
    render(<CorrectDuty period={period()} />);
    expect(screen.getByRole("button", { name: "Correct" })).toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: "Correct duty times" }),
    ).not.toBeInTheDocument();
  });
});

describe("the form", () => {
  it("offers both times as date-and-time, not time alone", () => {
    // A duty period spans midnight often enough, and the reported case
    // — forgetting to clock out — is exactly the one where the answer
    // is "yesterday".
    openForm();
    expect(screen.getByLabelText(/Duty in/)).toHaveAttribute(
      "type",
      "datetime-local",
    );
    expect(screen.getByLabelText(/Duty out/)).toHaveAttribute(
      "type",
      "datetime-local",
    );
  });

  it("prefills from the period", () => {
    openForm();
    // 06:00Z rendered in the test environment's zone.
    expect((screen.getByLabelText(/Duty in/) as HTMLInputElement).value).not.toBe(
      "",
    );
  });

  it("leaves duty out empty on a period that is still open", () => {
    openForm();
    expect((screen.getByLabelText(/Duty out/) as HTMLInputElement).value).toBe(
      "",
    );
  });

  it("says the original is kept", () => {
    // A pilot amending their own duty record should know it is kept,
    // not discover it later.
    openForm();
    expect(
      screen.getByText(/original times and your reason are kept/),
    ).toBeInTheDocument();
  });
});

describe("what gets sent", () => {
  it("will not submit without a reason", () => {
    openForm();
    fireEvent.change(screen.getByLabelText(/Duty out/), {
      target: { value: "2026-09-09T14:00" },
    });
    expect(
      screen.getByRole("button", { name: "Save correction" }),
    ).toBeDisabled();
  });

  it("sends only the field that changed", async () => {
    // An untouched field resubmitted with the same value would be
    // logged as an amendment that never happened.
    openForm();
    fireEvent.change(screen.getByLabelText(/Duty out/), {
      target: { value: "2026-09-09T14:00" },
    });
    fireEvent.change(screen.getByLabelText(/Why/), {
      target: { value: "Forgot to clock out." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));

    await waitFor(() => expect(amendDutyAction).toHaveBeenCalled());
    const [id, clockIn, clockOut, reason] = amendDutyAction.mock.calls[0];
    expect(id).toBe("d-1");
    expect(clockIn).toBeNull();
    expect(clockOut).toMatch(/^2026-09-09T/);
    expect(reason).toBe("Forgot to clock out.");
  });

  it("sends an ISO instant, not the local string it was typed as", async () => {
    openForm();
    fireEvent.change(screen.getByLabelText(/Duty out/), {
      target: { value: "2026-09-09T14:00" },
    });
    fireEvent.change(screen.getByLabelText(/Why/), {
      target: { value: "Forgot." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));

    await waitFor(() => expect(amendDutyAction).toHaveBeenCalled());
    expect(amendDutyAction.mock.calls[0][2]).toMatch(/Z$/);
  });
});

describe("when the server refuses", () => {
  it("shows the reason and keeps the form open", async () => {
    amendDutyAction.mockResolvedValue({
      status: "error",
      message: "Duty out has to be after duty in.",
    });
    openForm();
    fireEvent.change(screen.getByLabelText(/Duty out/), {
      target: { value: "2026-09-09T01:00" },
    });
    fireEvent.change(screen.getByLabelText(/Why/), {
      target: { value: "Mistyped." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Duty out has to be after duty in.",
      ),
    );
    // Still editable — the pilot has to be able to fix what they typed.
    expect(screen.getByLabelText(/Duty out/)).toBeInTheDocument();
  });
});

describe("when it works", () => {
  it("closes the form and confirms", async () => {
    openForm();
    fireEvent.change(screen.getByLabelText(/Duty out/), {
      target: { value: "2026-09-09T14:00" },
    });
    fireEvent.change(screen.getByLabelText(/Why/), {
      target: { value: "Forgot." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Corrected."),
    );
    expect(
      screen.queryByLabelText(/Duty out/),
    ).not.toBeInTheDocument();
  });
});
