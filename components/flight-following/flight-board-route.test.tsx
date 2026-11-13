import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(cleanup);

import type { BoardFlightItem } from "@/lib/api/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/flight-following/check-in-action", () => ({
  checkInFlightAction: vi.fn(),
}));

import { FlightBoard } from "./flight-board";

const row = {
  id: "f-1",
  flight_number: "GV2026",
  aircraft: { id: "a-1", tail_number: "N503PA", model: "Cessna 208B", seats: 9 },
  origin: "PABE",
  destination: "PASM",
  stops: ["PABE", "PAHP", "PASM"],
  scheduled_departure_at: "2026-09-27T16:00:00Z",
  scheduled_arrival_at: "2026-09-27T17:35:00Z",
  actual_departure_at: null,
  actual_arrival_at: null,
  status: "scheduled",
  pax_count: 4,
  cargo_lbs: 200,
  pic_name: null,
  is_overdue: false,
  last_contact_at: null,
} as BoardFlightItem;

describe("the Flight Following board", () => {
  it("shows every stop of a multi-leg flight", () => {
    // Client, 27 Sep: flights can now be built with several legs.
    render(<FlightBoard flights={[row]} />);
    expect(screen.getByText("PAHP")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /GV2026/ })).toHaveTextContent("PABE → PAHP → PASM");
  });

  it("offers Edit until the flight is released (#132)", () => {
    // Client, 23 Oct: "is there a way that we can go back in and edit a
    // flight after it's made it to this stage?"
    render(<FlightBoard canDispatch flights={[row, { ...row, id: "f-2", flight_number: "GV2027", status: "released" }]} />);
    const edits = screen.getAllByRole("link", { name: "Edit" });
    expect(edits.map((a) => a.getAttribute("href"))).toEqual(["/dispatch?flight=f-1&edit=1"]);
  });
  it("hides dispatch-only movement and edit controls from read-only viewers", () => {
    render(<FlightBoard flights={[row, { ...row, id: "f-2", status: "released" }]} />);
    expect(screen.queryByRole("button", { name: "Mark Departed" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Update" })).toBeNull();
  });

  // LOG-14 (Greg, 13 Nov: "mark those"): marked at each stop.
  describe("a multi-stop flight marked at each stop", () => {
    const legs = [
      { sequence: 1, origin: "PABE", destination: "PAHP", scheduled_departure_at: "2026-09-27T16:00:00Z",
        scheduled_arrival_at: "2026-09-27T16:40:00Z", actual_departure_at: "2026-09-27T16:02:00Z",
        actual_arrival_at: "2026-09-27T16:40:00Z" },
      { sequence: 2, origin: "PAHP", destination: "PASM", scheduled_departure_at: "2026-09-27T17:00:00Z",
        scheduled_arrival_at: "2026-09-27T17:35:00Z", actual_departure_at: null, actual_arrival_at: null },
    ];  // prettier-ignore
    const released = { ...row, status: "released", actual_departure_at: "2026-09-27T16:02:00Z", legs } as BoardFlightItem;

    it("is on the ground at its stop, and leaves it next", () => {
      render(<FlightBoard canDispatch flights={[released]} />);
      const line = screen.getByRole("row", { name: /GV2026/ });
      expect(line).toHaveTextContent("At PAHP");
      expect(line).toHaveTextContent("PAHP 08:40 AKDT, on the ground");
      expect(screen.getByRole("button", { name: "Mark Departed PAHP" })).toBeInTheDocument();
    });

    it("is in the air again once it has left, bound for the next stop", () => {
      const away = [legs[0], { ...legs[1], actual_departure_at: "2026-09-27T17:05:00Z" }];
      render(<FlightBoard canDispatch flights={[{ ...released, legs: away }]} />);
      const line = screen.getByRole("row", { name: /GV2026/ });
      expect(line).toHaveTextContent("Airborne");
      expect(line).toHaveTextContent("PAHP 08:40–09:05 AKDT");
      expect(screen.getByRole("button", { name: "Mark Arrived PASM" })).toBeInTheDocument();
    });
  });
});
