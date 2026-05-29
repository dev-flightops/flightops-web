import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  AircraftListItem,
  FlightDetail,
} from "@/lib/api/types";

const updateFlightAction = vi.fn();
vi.mock("@/app/(app)/dispatch/[flightId]/actions", () => ({
  updateFlightAction: (...args: unknown[]) => updateFlightAction(...args),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { EditFlightDialog } from "./edit-flight-dialog";

const aircraft207: AircraftListItem = {
  id: "ac-1",
  tail_number: "N207GE",
  model: "Cessna 208 Caravan",
  seats: 9,
  max_payload_lbs: 3000,
  is_active: true,
};

const aircraft510: AircraftListItem = {
  id: "ac-2",
  tail_number: "N510PA",
  model: "Beechcraft 1900D",
  seats: 19,
  max_payload_lbs: 4500,
  is_active: true,
};

const baseFlight: FlightDetail = {
  id: "00000000-0000-0000-0000-000000000001",
  flight_number: "GV101",
  origin: "PADU",
  destination: "PANC",
  scheduled_departure_at: "2026-06-01T14:00:00Z",
  scheduled_arrival_at: "2026-06-01T16:00:00Z",
  status: "scheduled",
  aircraft: {
    id: aircraft207.id,
    tail_number: aircraft207.tail_number,
    model: aircraft207.model,
    seats: aircraft207.seats,
  },
  pax_count: 4,
  cargo_lbs: 200,
  notes: null,
  max_payload_lbs: 3000,
  released_at: null,
  released_by: null,
};

describe("EditFlightDialog", () => {
  it("renders the Edit button and opens the dialog on click", async () => {
    const user = userEvent.setup();
    render(
      <EditFlightDialog flight={baseFlight} aircraft={[aircraft207, aircraft510]} />,
    );
    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/flight number/i)).toHaveValue("GV101");
  });

  it("submits only the changed fields", async () => {
    updateFlightAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <EditFlightDialog flight={baseFlight} aircraft={[aircraft207, aircraft510]} />,
    );
    await user.click(screen.getByRole("button", { name: /edit/i }));

    const paxInput = screen.getByLabelText(/passengers/i);
    await user.clear(paxInput);
    await user.type(paxInput, "8");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateFlightAction).toHaveBeenCalledWith(baseFlight.id, {
      pax_count: 8,
    });
  });

  it("shows the server-action error message when saving fails", async () => {
    updateFlightAction.mockResolvedValue({
      ok: false,
      error: "Another flight already uses that flight number at that time.",
    });
    const user = userEvent.setup();
    render(
      <EditFlightDialog flight={baseFlight} aircraft={[aircraft207, aircraft510]} />,
    );
    await user.click(screen.getByRole("button", { name: /edit/i }));

    const flightNumberInput = screen.getByLabelText(/flight number/i);
    await user.clear(flightNumberInput);
    await user.type(flightNumberInput, "GV999");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText(/already uses that flight number/i),
    ).toBeInTheDocument();
  });

  it("closes without calling the server action when no fields changed", async () => {
    updateFlightAction.mockReset();
    const user = userEvent.setup();
    render(
      <EditFlightDialog flight={baseFlight} aircraft={[aircraft207, aircraft510]} />,
    );
    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateFlightAction).not.toHaveBeenCalled();
  });
});
