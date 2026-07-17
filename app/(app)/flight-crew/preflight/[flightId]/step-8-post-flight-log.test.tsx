import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeStepAction } = vi.hoisted(() => ({
  completeStepAction: vi.fn(),
}));

vi.mock("./actions", () => ({ completeStepAction }));

import { PostFlightLogStep } from "./step-8-post-flight-log";
import type { FlightDetail } from "@/lib/api/types";

const FLIGHT = {
  id: "f-1",
  flight_number: "GV207",
  origin: "PANC",
  destination: "PADQ",
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

describe("PostFlightLogStep (M2-G-7 step 8)", () => {
  it("renders the step header, elog link, and complete button", () => {
    render(<PostFlightLogStep flightId="f-1" flight={FLIGHT} />);
    expect(screen.getByText(/Post-Flight Log/i)).toBeInTheDocument();
    // Flight number appears in the copy.
    expect(screen.getByText(/GV207/)).toBeInTheDocument();
    // Origin → Destination in the copy.
    expect(screen.getByText(/PANC → PADQ/)).toBeInTheDocument();
    // Elog link.
    const link = screen.getByRole("link", { name: /Open Flight Log/i });
    expect(link).toHaveAttribute("href", "/flight-crew/elog");
    // Complete button available immediately (no ack required — this
    // is the "you know where to file it" handoff, not the elog itself).
    expect(
      screen.getByRole("button", { name: /Mark preflight complete/i }),
    ).toBeEnabled();
  });

  it("calls completeStepAction with step=8 on click", async () => {
    completeStepAction.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<PostFlightLogStep flightId="f-1" flight={FLIGHT} />);
    await user.click(
      screen.getByRole("button", { name: /Mark preflight complete/i }),
    );
    expect(completeStepAction).toHaveBeenCalledWith("f-1", 8, {
      flight_number: "GV207",
    });
  });

  it("surfaces the error message when the action fails", async () => {
    completeStepAction.mockResolvedValueOnce({
      ok: false,
      error: "Couldn't save (HTTP 500).",
    });
    const user = userEvent.setup();
    render(<PostFlightLogStep flightId="f-1" flight={FLIGHT} />);
    await user.click(
      screen.getByRole("button", { name: /Mark preflight complete/i }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/HTTP 500/i);
  });
});
