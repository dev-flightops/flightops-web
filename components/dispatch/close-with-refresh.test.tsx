import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FlightDetail } from "@/lib/api/types";

// 1124-31: "After cancelling a flight, Delete Flight doesn't appear until the
// page is reloaded." The cancel took under a second; the packet took ten to
// render again. The dialog closed when the action returned and the refresh
// ran outside its transition, so the packet went on showing the flight as
// scheduled, with no sign anything was happening, and the client reloaded.
//
// The refresh, and the close with it, now run inside the dialog's
// transition: it stays on "Cancelling…" until the new packet is on screen.
// After an await that takes a transition of its own, which is what this
// checks: React 18 in the tests can't hold a transition open, so the test
// stands in for one and records whether refresh() was called inside it.
const t = vi.hoisted(() => ({
  depth: 0,
  refreshes: [] as boolean[],
  cancelScheduledFlightAction: vi.fn(),
  pullBackReleaseAction: vi.fn(),
  cancelReleasedFlightAction: vi.fn(),
  releaseFlightAction: vi.fn(),
  flightWalkUpsAction: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    // A transition lasts for the synchronous part of its callback, as in
    // React: whatever runs after an await is outside it.
    useTransition: () => [
      false,
      (callback: () => unknown) => {
        t.depth += 1;
        try {
          return callback();
        } finally {
          t.depth -= 1;
        }
      },
    ],
  };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => t.refreshes.push(t.depth > 0) }),
}));
vi.mock("@/app/(app)/dispatch/[flightId]/actions", () => ({
  cancelScheduledFlightAction: t.cancelScheduledFlightAction,
  pullBackReleaseAction: t.pullBackReleaseAction,
  cancelReleasedFlightAction: t.cancelReleasedFlightAction,
  releaseFlightAction: t.releaseFlightAction,
  flightWalkUpsAction: t.flightWalkUpsAction,
}));

import { CancelFlight } from "./cancel-flight";
import { GeneratePdfButton } from "./packet/generate-pdf-button";
import { ReleaseButton } from "./release-button";
import { WithdrawRelease } from "./withdraw-release";

beforeEach(() => {
  t.depth = 0;
  t.refreshes = [];
  for (const action of [
    t.cancelScheduledFlightAction,
    t.pullBackReleaseAction,
    t.cancelReleasedFlightAction,
    t.releaseFlightAction,
  ]) {
    action.mockReset().mockResolvedValue({ ok: true });
  }
  t.flightWalkUpsAction.mockReset().mockResolvedValue([]);
});

async function refreshedInsideTheTransition() {
  await waitFor(() => expect(t.refreshes).toHaveLength(1));
  expect(t.refreshes).toEqual([true]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

describe("A dialog that changes the flight closes with the refreshed packet (1124-31)", () => {
  it("Cancel Flight", async () => {
    const user = userEvent.setup();
    render(<CancelFlight flightId="f-1" flightNumber="GV1111" />);
    await user.click(screen.getByRole("button", { name: "Cancel Flight" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel Flight" }));
    expect(t.cancelScheduledFlightAction).toHaveBeenCalledWith("f-1", "");
    await refreshedInsideTheTransition();
  });

  it.each([
    ["Pull back release", "Pull back release"],
    ["Cancel flight", "Cancel flight"],
  ])("%s on a released flight", async (opener, confirm) => {
    const user = userEvent.setup();
    render(<WithdrawRelease flightId="f-1" flightNumber="PGR701" />);
    await user.click(screen.getByRole("button", { name: opener }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "Weather below minimums");
    await user.click(within(dialog).getByRole("button", { name: confirm }));
    await refreshedInsideTheTransition();
  });

  it("Release dispatch", async () => {
    const user = userEvent.setup();
    render(<ReleaseButton flightId="f-1" flightNumber="GV101" stops={["PABE", "PAEM"]} />);
    await user.click(screen.getByRole("button", { name: /Release dispatch/ }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Release" }));
    expect(t.releaseFlightAction).toHaveBeenCalled();
    await refreshedInsideTheTransition();
  });

  it("Generate PDF, which releases the flight", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const flight = {
      id: "f-1",
      flight_number: "GV101",
      origin: "PABE",
      destination: "PAEM",
      status: "scheduled",
      scheduled_departure_at: "2026-08-01T14:00:00Z",
      scheduled_arrival_at: "2026-08-01T16:00:00Z",
      aircraft: { id: "a-1", tail_number: "N207GE", model: "Cessna 208 Caravan", seats: 9 },
      released_at: null,
      released_by: null,
      passenger_count: 0,
      cargo_weight_lbs: 0,
    } as unknown as FlightDetail;
    const user = userEvent.setup();
    render(<GeneratePdfButton flight={flight} />);
    await user.click(screen.getByRole("button", { name: /Generate PDF/ }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Release & generate" }));
    await refreshedInsideTheTransition();
    expect(open).toHaveBeenCalled();
    open.mockRestore();
  });
});
