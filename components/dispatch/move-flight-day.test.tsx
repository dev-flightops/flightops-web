import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { moveFlightDayAction, refresh, replace } = vi.hoisted(() => ({
  moveFlightDayAction: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@/app/(app)/dispatch/[flightId]/actions", () => ({ moveFlightDayAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace }) }));

import type { FlightMoveResult } from "@/lib/api/ops";
import type { FlightDetail } from "@/lib/api/types";

import { MoveFlightDay } from "./move-flight-day";

/**
 * The client, 10/30: "There was no easy way to move the flight to the next
 * day so I cancelled the flight."
 */
const ZONE = "America/Anchorage";

function moved(over: Partial<FlightMoveResult> = {}): FlightMoveResult {
  return {
    flight: { scheduled_departure_at: "2026-10-31T17:33:00Z" } as FlightDetail,
    days: 1,
    release_withdrawn: false,
    bookings_moved: 0,
    fuel_orders_moved: 0,
    passengers_rebooked: 0,
    trips_out_of_order: [],
    ...over,
  };
}

function open(props: Partial<Parameters<typeof MoveFlightDay>[0]> = {}) {
  render(
    <MoveFlightDay
      flightId="f-1"
      flightNumber="MM1122"
      departsAt="2026-10-30T09:33"
      timeZone={ZONE}
      {...props}
    />,
  );
  return screen.getByRole("button", { name: "Move to Another Day" });
}

describe("MoveFlightDay (#174)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    moveFlightDayAction.mockResolvedValue({ ok: true, moved: moved() });
  });

  it("starts on the next day, and moves a planned flight with no reason", async () => {
    const user = userEvent.setup();
    await user.click(open());
    expect(screen.getByLabelText("New day")).toHaveValue("2026-10-31");
    expect(screen.queryByLabelText("Reason")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Move Flight" }));
    expect(moveFlightDayAction).toHaveBeenCalledWith("f-1", "2026-10-31", "");
    expect(await screen.findByText("MM1122 is now on Oct 31, 2026")).toBeInTheDocument();
  });

  it("won't go to the day it's already on, or to no day", async () => {
    const user = userEvent.setup();
    await user.click(open());
    const day = screen.getByLabelText("New day");
    await user.clear(day);
    expect(screen.getByRole("button", { name: "Move Flight" })).toBeDisabled();
    await user.type(day, "2026-10-30");
    expect(screen.getByRole("button", { name: "Move Flight" })).toBeDisabled();
  });

  it("needs a reason on a released flight, and says the release goes", async () => {
    moveFlightDayAction.mockResolvedValue({
      ok: true,
      moved: moved({ release_withdrawn: true }),
    });
    const user = userEvent.setup();
    await user.click(open({ released: true }));
    expect(screen.getByRole("button", { name: "Move Flight" })).toBeDisabled();
    await user.type(screen.getByLabelText("Reason"), "Need to change the date");
    await user.click(screen.getByRole("button", { name: "Move Flight" }));
    expect(moveFlightDayAction).toHaveBeenCalledWith("f-1", "2026-10-31", "Need to change the date");
    expect(await screen.findByText("The release was taken back.")).toBeInTheDocument();
  });

  it("says what moved and what starts over, and refreshes only when it closes", async () => {
    moveFlightDayAction.mockResolvedValue({
      ok: true,
      moved: moved({ bookings_moved: 2, fuel_orders_moved: 1, passengers_rebooked: 3 }),
    });
    const user = userEvent.setup();
    await user.click(open());
    await user.click(screen.getByRole("button", { name: "Move Flight" }));
    expect(await screen.findByText("2 bookings moved with it.")).toBeInTheDocument();
    expect(screen.getByText("1 fuel order moved with it.")).toBeInTheDocument();
    expect(
      screen.getByText("3 passengers checked in, on board or marked a no-show are booked again."),
    ).toBeInTheDocument();
    expect(screen.getByText(/FRAT filed and signed again/)).toBeInTheDocument();
    expect(screen.getByText(/nothing is sent to them/)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names a return trip whose halves changed places", async () => {
    moveFlightDayAction.mockResolvedValue({
      ok: true,
      moved: moved({
        trips_out_of_order: [
          {
            booking_id: "b-1",
            customer: "Marcus Tester",
            moved_departs: "2026-10-31T17:33:00Z",
            other_booking_id: "c8eb2347-0000-4000-8000-000000000000",
            other_departs: "2026-10-30T23:00:00Z",
          },
        ],
      }),
    });
    const user = userEvent.setup();
    await user.click(open());
    await user.click(screen.getByRole("button", { name: "Move Flight" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Marcus Tester's return trip is out of order");
    expect(alert).toHaveTextContent("Oct 31, 09:33 AKDT");
    expect(alert).toHaveTextContent("Oct 30, 15:00 AKDT");
    expect(screen.getByRole("link", { name: "BK-C8EB2347" })).toHaveAttribute(
      "href",
      "/reservations/bookings/c8eb2347-0000-4000-8000-000000000000",
    );
  });

  it("says why when ops refuses, and leaves the dialog open", async () => {
    moveFlightDayAction.mockResolvedValue({
      ok: false,
      error: "The aircraft is already on MM2200 (17:00Z–19:00Z). Pick another aircraft or other times.",
    });
    const user = userEvent.setup();
    await user.click(open());
    await user.click(screen.getByRole("button", { name: "Move Flight" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already on MM2200");
    expect(screen.getByRole("button", { name: "Move Flight" })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("opens by itself from the schedule's link, which comes off the address after", async () => {
    const user = userEvent.setup();
    render(
      <MoveFlightDay
        flightId="f-1"
        flightNumber="MM1122"
        departsAt="2026-10-30T09:33"
        timeZone={ZONE}
        defaultOpen
      />,
    );
    expect(screen.getByLabelText("New day")).toHaveValue("2026-10-31");
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(replace).toHaveBeenCalledWith("/dispatch?flight=f-1");
    expect(refresh).not.toHaveBeenCalled();
  });
});
