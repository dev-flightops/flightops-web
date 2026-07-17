import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeStepAction } = vi.hoisted(() => ({
  completeStepAction: vi.fn(),
}));

vi.mock("./actions", () => ({ completeStepAction }));

import { PositionReportsStep } from "./step-7-position-reports";
import type { FlightDetail } from "@/lib/api/types";

const FLIGHT = {
  id: "f-1",
  flight_number: "GV101",
  origin: "PANC",
  destination: "PADU",
  status: "released",
  aircraft: {
    id: "a-1",
    tail_number: "N207GE",
    model: "Cessna 208 Caravan",
    seats: 9,
  },
} as unknown as FlightDetail;

beforeEach(() => {
  completeStepAction.mockReset();
});

describe("PositionReportsStep (M2-G-7 step 7)", () => {
  it("renders the step header, checklist, and Continue button", () => {
    render(<PositionReportsStep flightId="f-1" flight={FLIGHT} />);
    expect(
      screen.getByText(/Flight Following Position Reports/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Live Flight Following board/i)).toBeInTheDocument();
    // Manual-report fallback callout — text is broken across nodes so
    // match with a substring that lives on a single element.
    expect(
      screen.getByText(/give a verbal position/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Continue to Step 8/i }),
    ).toBeDisabled();
  });

  it("enables the Continue button once the ack checkbox is ticked", async () => {
    const user = userEvent.setup();
    render(<PositionReportsStep flightId="f-1" flight={FLIGHT} />);
    await user.click(screen.getByRole("checkbox"));
    expect(
      screen.getByRole("button", { name: /Continue to Step 8/i }),
    ).toBeEnabled();
  });

  it("calls completeStepAction with step=7 and a metadata payload on click", async () => {
    completeStepAction.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<PositionReportsStep flightId="f-1" flight={FLIGHT} />);
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: /Continue to Step 8/i }),
    );
    expect(completeStepAction).toHaveBeenCalledWith("f-1", 7, {
      flight_number: "GV101",
      tracker_configured: true,
    });
  });

  it("surfaces the error message when completeStepAction returns not-ok", async () => {
    completeStepAction.mockResolvedValueOnce({
      ok: false,
      error: "Step state changed — refresh to continue.",
    });
    const user = userEvent.setup();
    render(<PositionReportsStep flightId="f-1" flight={FLIGHT} />);
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: /Continue to Step 8/i }),
    );
    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(/Step state changed/i);
  });
});
