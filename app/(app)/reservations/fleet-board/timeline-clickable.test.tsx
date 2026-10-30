import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn(), move: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: nav.refresh, push: nav.push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("./actions", () => ({ moveOnBoardAction: nav.move }));

import { DRAG_TYPE, type DraggedBooking } from "./booking-clickable";
import { TimelineClickable } from "./timeline-clickable";

/**
 * The client, 29 Oct: "Need to be able to drag and drop flights from
 * different airplanes" (#150). As legacy, the whole flight moves.
 */
const mm1122: DraggedBooking = {
  bookingId: "b-1",
  flightId: "f-1122",
  flightNumber: "MM1122",
  onFlight: 2,
  fromAircraftId: "ac-806",
};

function drop(target: Element, dragged: DraggedBooking) {
  const dataTransfer = { types: [DRAG_TYPE], getData: () => JSON.stringify(dragged), dropEffect: "none" };
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
}

function row() {
  render(
    <TimelineClickable aircraftId="ac-100" tailNumber="N100PA" isoDay="2026-10-29">
      <span>N100PA track</span>
    </TimelineClickable>,
  );
  return screen.getByText("N100PA track").parentElement as Element;
}

beforeEach(() => {
  nav.refresh.mockReset();
  nav.move.mockReset();
});

describe("dropping a block on another aircraft (#150)", () => {
  it("asks before moving the whole flight, then moves it", async () => {
    nav.move.mockResolvedValue({ ok: true });
    drop(row(), mm1122);
    expect(screen.getByRole("dialog", { name: "Move to another aircraft" })).toHaveTextContent(
      "Move MM1122 (2 bookings) to N100PA?",
    );
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(nav.move).toHaveBeenCalledWith({
      bookingId: "b-1",
      flightId: "f-1122",
      flightNumber: "MM1122",
      toAircraftId: "ac-100",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says why a move was refused, and keeps the question open", async () => {
    nav.move.mockResolvedValue({
      ok: false,
      error: "MM1122 is released: pull the release back before moving it to another aircraft.",
    });
    drop(row(), mm1122);
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("pull the release back");
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  it("puts a booking on no flight on the aircraft, and ignores a drop on its own row", () => {
    const target = row();
    drop(target, { ...mm1122, fromAircraftId: "ac-100" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    drop(target, { ...mm1122, flightId: null, flightNumber: null, onFlight: 1, fromAircraftId: null });
    expect(screen.getByRole("dialog")).toHaveTextContent("Put this booking on N100PA?");
  });
});
