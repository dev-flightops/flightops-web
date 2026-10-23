import { fireEvent, render, screen } from "@testing-library/react";
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
  make: null,
  serial_number: null,
  year: null,
  is_active: true,
};

const aircraft510: AircraftListItem = {
  id: "ac-2",
  tail_number: "N510PA",
  model: "Beechcraft 1900D",
  seats: 19,
  max_payload_lbs: 4500,
  make: null,
  serial_number: null,
  year: null,
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

const ZONES = { byIcao: { PADU: "America/Anchorage" }, fallback: "America/Anchorage" };

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

  it("shows the times in the departure base's local time, with Zulu under each (#68)", async () => {
    const user = userEvent.setup();
    render(<EditFlightDialog flight={baseFlight} aircraft={[aircraft207]} zones={ZONES} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    // 14:00Z on 1 June is 06:00 in Alaska summer time.
    const departure = screen.getByLabelText("Departure (AKDT)");
    expect(departure).toHaveValue("2026-06-01T06:00");
    expect(screen.getByText("= 14:00Z 2026-06-01")).toBeInTheDocument();
  });

  it("saves a changed local time in UTC", async () => {
    updateFlightAction.mockReset().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EditFlightDialog flight={baseFlight} aircraft={[aircraft207]} zones={ZONES} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.change(screen.getByLabelText("Departure (AKDT)"), {
      target: { value: "2026-06-01T07:30" },
    });
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateFlightAction).toHaveBeenCalledWith(baseFlight.id, {
      scheduled_departure_at: "2026-06-01T15:30:00Z",
    });
  });

  it("adds a stop to a one-leg flight, departing when the first leg lands (#106)", async () => {
    updateFlightAction.mockReset().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EditFlightDialog flight={baseFlight} aircraft={[aircraft207]} zones={ZONES} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: "+ Add Stop" }));
    expect(screen.getByLabelText("Leg 2 Departure (AKDT)")).toHaveValue("2026-06-01T08:00");
    await user.type(screen.getByLabelText("Leg 2 Destination"), "padu");
    fireEvent.change(screen.getByLabelText("Leg 2 Arrival (AKDT)"), {
      target: { value: "2026-06-01T10:00" },
    });
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateFlightAction).toHaveBeenLastCalledWith(baseFlight.id, {
      legs: [
        {
          origin: "PADU",
          destination: "PANC",
          scheduled_departure_at: "2026-06-01T14:00:00Z",
          scheduled_arrival_at: "2026-06-01T16:00:00Z",
        },
        {
          origin: "PANC",
          destination: "PADU",
          scheduled_departure_at: "2026-06-01T16:00:00Z",
          scheduled_arrival_at: "2026-06-01T18:00:00Z",
        },
      ],
    });
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

describe("EditFlightDialog — a multi-leg flight", () => {
  const multiLeg: FlightDetail = {
    ...baseFlight,
    origin: "PABE",
    destination: "PASM",
    stops: ["PABE", "PAHP", "PASM"],
    legs: [
      {
        sequence: 1,
        origin: "PABE",
        destination: "PAHP",
        scheduled_departure_at: "2026-06-01T14:00:00Z",
        scheduled_arrival_at: "2026-06-01T14:40:00Z",
      },
      {
        sequence: 2,
        origin: "PAHP",
        destination: "PASM",
        scheduled_departure_at: "2026-06-01T15:00:00Z",
        scheduled_arrival_at: "2026-06-01T15:35:00Z",
      },
    ],
  };

  it("shows every leg, and a passengers-only edit leaves the route alone", async () => {
    updateFlightAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EditFlightDialog flight={multiLeg} aircraft={[aircraft207, aircraft510]} zones={ZONES} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByLabelText("Origin")).toHaveValue("PABE");
    expect(screen.getByLabelText("Leg 1 Destination")).toHaveValue("PAHP");
    expect(screen.getByLabelText("Leg 2 Destination")).toHaveValue("PASM");
    expect(screen.getByLabelText("Leg 2 Departure (AKDT)")).toHaveValue("2026-06-01T07:00");

    const pax = screen.getByLabelText(/passengers/i);
    await user.clear(pax);
    await user.type(pax, "6");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateFlightAction).toHaveBeenLastCalledWith(multiLeg.id, { pax_count: 6 });
  });

  it("changes a stop and sends the whole route (#106)", async () => {
    updateFlightAction.mockReset().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EditFlightDialog flight={multiLeg} aircraft={[aircraft207]} zones={ZONES} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    const dest = screen.getByLabelText("Leg 2 Destination");
    await user.clear(dest);
    await user.type(dest, "9z8");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateFlightAction).toHaveBeenLastCalledWith(multiLeg.id, {
      legs: [
        {
          origin: "PABE",
          destination: "PAHP",
          scheduled_departure_at: "2026-06-01T14:00:00Z",
          scheduled_arrival_at: "2026-06-01T14:40:00Z",
        },
        {
          origin: "PAHP",
          destination: "9Z8",
          scheduled_departure_at: "2026-06-01T15:00:00Z",
          scheduled_arrival_at: "2026-06-01T15:35:00Z",
        },
      ],
    });
  });

  it("takes the stops off, making it one leg again", async () => {
    updateFlightAction.mockReset().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EditFlightDialog flight={multiLeg} aircraft={[aircraft207]} zones={ZONES} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: "Remove leg 2" }));
    expect(screen.queryByLabelText("Leg 2 Destination")).toBeNull();
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateFlightAction).toHaveBeenLastCalledWith(multiLeg.id, {
      legs: [],
      origin: "PABE",
      destination: "PAHP",
      scheduled_departure_at: "2026-06-01T14:00:00Z",
      scheduled_arrival_at: "2026-06-01T14:40:00Z",
    });
  });

  it("refuses a stop that departs before the leg before it lands", async () => {
    updateFlightAction.mockReset();
    const user = userEvent.setup();
    render(<EditFlightDialog flight={multiLeg} aircraft={[aircraft207]} zones={ZONES} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.change(screen.getByLabelText("Leg 2 Departure (AKDT)"), {
      target: { value: "2026-06-01T06:30" },
    });
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText("Departs before the leg before it lands")).toBeInTheDocument();
    expect(updateFlightAction).not.toHaveBeenCalled();
  });

  it("does not send the times back even when they do not round-trip", async () => {
    // The form holds minutes, so a time stored with seconds comes back
    // different. On a single-leg flight that only trims the seconds; on
    // a multi-leg one it would get a passengers-only edit refused.
    updateFlightAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const withSeconds: FlightDetail = {
      ...multiLeg,
      scheduled_departure_at: "2026-06-01T14:00:30Z",
      scheduled_arrival_at: "2026-06-01T15:35:45Z",
    };
    render(<EditFlightDialog flight={withSeconds} aircraft={[aircraft207, aircraft510]} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    const pax = screen.getByLabelText(/passengers/i);
    await user.clear(pax);
    await user.type(pax, "6");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateFlightAction).toHaveBeenLastCalledWith(withSeconds.id, { pax_count: 6 });
  });
});
