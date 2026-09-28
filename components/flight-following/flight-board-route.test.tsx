import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
});
