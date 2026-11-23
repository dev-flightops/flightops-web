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

  it("says when the save starts the FRAT over (1119-21)", async () => {
    updateFlightAction.mockResolvedValue({ ok: true, offRoute: null, fratStartsOver: ["VFR or IFR", "alternate"] });
    const user = userEvent.setup();
    render(<EditFlightDialog flight={baseFlight} aircraft={[aircraft207, aircraft510]} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    const paxInput = screen.getByLabelText(/passengers/i);
    await user.clear(paxInput);
    await user.type(paxInput, "8");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "The FRAT starts over: VFR or IFR, alternate changed, and the FRAT was scored on them. File a new one; it is signed again before release.",
    );
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

  it("saves a changed local time in UTC, the arrival following it (#202)", async () => {
    updateFlightAction.mockReset().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EditFlightDialog flight={baseFlight} aircraft={[aircraft207]} zones={ZONES} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.change(screen.getByLabelText("Departure (AKDT)"), {
      target: { value: "2026-06-01T07:30" },
    });
    // The two hours it took still take two hours.
    expect(screen.getByLabelText("Arrival (AKDT)")).toHaveValue("2026-06-01T09:30");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateFlightAction).toHaveBeenCalledWith(baseFlight.id, {
      scheduled_departure_at: "2026-06-01T15:30:00Z",
      scheduled_arrival_at: "2026-06-01T17:30:00Z",
    });
  });

  it("keeps an arrival typed by hand when the departure moves", async () => {
    updateFlightAction.mockReset().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EditFlightDialog flight={baseFlight} aircraft={[aircraft207]} zones={ZONES} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.change(screen.getByLabelText("Arrival (AKDT)"), { target: { value: "2026-06-01T08:45" } });
    fireEvent.change(screen.getByLabelText("Departure (AKDT)"), { target: { value: "2026-06-01T06:30" } });
    expect(screen.getByLabelText("Arrival (AKDT)")).toHaveValue("2026-06-01T08:45");
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

  it("marks a VFR flight IFR, and back (#123)", async () => {
    updateFlightAction.mockReset().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const { unmount } = render(
      <EditFlightDialog flight={baseFlight} aircraft={[aircraft207, aircraft510]} />,
    );
    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByLabelText("Flown IFR")).not.toBeChecked();
    await user.click(screen.getByLabelText("Flown IFR"));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateFlightAction).toHaveBeenLastCalledWith(baseFlight.id, { is_ifr: true });
    unmount();

    render(
      <EditFlightDialog
        flight={{ ...baseFlight, is_ifr: true }}
        aircraft={[aircraft207, aircraft510]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByLabelText("Flown IFR")).toBeChecked();
    await user.click(screen.getByLabelText("Flown IFR"));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateFlightAction).toHaveBeenLastCalledWith(baseFlight.id, { is_ifr: false });
  });

  it("asks an IFR flight for its alternate, for its fuel (#201)", async () => {
    updateFlightAction.mockReset().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const { unmount } = render(
      <EditFlightDialog flight={baseFlight} aircraft={[aircraft207, aircraft510]} />,
    );
    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.queryByLabelText("Alternate")).toBeNull();
    await user.click(screen.getByLabelText("Flown IFR"));
    await user.type(screen.getByLabelText("Alternate"), "pa-b");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText("3- or 4-character airport code (ICAO or FAA)")).toBeInTheDocument();
    expect(updateFlightAction).not.toHaveBeenCalled();
    // Unticked, the hidden box holds nothing up: the flight stays VFR, unchanged.
    await user.click(screen.getByLabelText("Flown IFR"));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(updateFlightAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.click(screen.getByLabelText("Flown IFR"));
    await user.clear(screen.getByLabelText("Alternate"));
    await user.type(screen.getByLabelText("Alternate"), "pabe");
    expect(screen.getByLabelText("Alternate")).toHaveValue("PABE");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateFlightAction).toHaveBeenLastCalledWith(baseFlight.id, {
      is_ifr: true,
      alternate_ident: "PABE",
    });
    unmount();

    // An IFR flight shows its alternate; emptied, it goes.
    render(
      <EditFlightDialog
        flight={{ ...baseFlight, is_ifr: true, alternate_ident: "PABE" }}
        aircraft={[aircraft207, aircraft510]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByLabelText("Alternate")).toHaveValue("PABE");
    await user.clear(screen.getByLabelText("Alternate"));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateFlightAction).toHaveBeenLastCalledWith(baseFlight.id, { alternate_ident: null });
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

  it("moves every later leg with a new departure time, keeping their lengths (#202)", async () => {
    // BK-FD6204DD, 19 Nov: the departure changed and the arrival stayed put.
    updateFlightAction.mockReset().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EditFlightDialog flight={multiLeg} aircraft={[aircraft207]} zones={ZONES} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.change(screen.getByLabelText("Departure (AKDT)"), { target: { value: "2026-06-01T07:15" } });
    expect(screen.getByLabelText("Arrival (AKDT)")).toHaveValue("2026-06-01T07:55");
    expect(screen.getByLabelText("Leg 2 Departure (AKDT)")).toHaveValue("2026-06-01T08:15");
    expect(screen.getByLabelText("Leg 2 Arrival (AKDT)")).toHaveValue("2026-06-01T08:50");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateFlightAction).toHaveBeenLastCalledWith(multiLeg.id, {
      legs: [
        {
          origin: "PABE",
          destination: "PAHP",
          scheduled_departure_at: "2026-06-01T15:15:00Z",
          scheduled_arrival_at: "2026-06-01T15:55:00Z",
        },
        {
          origin: "PAHP",
          destination: "PASM",
          scheduled_departure_at: "2026-06-01T16:15:00Z",
          scheduled_arrival_at: "2026-06-01T16:50:00Z",
        },
      ],
    });
  });

  it("moves nothing else when the date changes: that's Move to Another Day", async () => {
    const user = userEvent.setup();
    render(<EditFlightDialog flight={multiLeg} aircraft={[aircraft207]} zones={ZONES} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.change(screen.getByLabelText("Departure (AKDT)"), { target: { value: "2026-06-02T06:00" } });
    expect(screen.getByLabelText("Arrival (AKDT)")).toHaveValue("2026-06-01T06:40");
    expect(screen.getByLabelText("Leg 2 Departure (AKDT)")).toHaveValue("2026-06-01T07:00");
  });

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

  it("refuses a first leg dated days before the last one lands (client, 18 Nov)", async () => {
    updateFlightAction.mockReset();
    const user = userEvent.setup();
    render(<EditFlightDialog flight={multiLeg} aircraft={[aircraft207]} zones={ZONES} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.change(screen.getByLabelText("Departure (AKDT)"), {
      target: { value: "2026-05-26T06:00" },
    });
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(
      await screen.findByText("The last leg lands more than 24 hours after this. Check the dates."),
    ).toBeInTheDocument();
    expect(updateFlightAction).not.toHaveBeenCalled();
  });

  it("counts a night across the clock change in real hours", async () => {
    // Alaska springs forward on 14 Mar 2027: 10:00 AKST to 10:20 AKDT the
    // next day is 23 h 20 min, though the clocks read 24 h 20 min.
    updateFlightAction.mockReset().mockResolvedValue({ ok: true });
    const overnight: FlightDetail = {
      ...baseFlight,
      scheduled_departure_at: "2027-03-13T19:00:00Z",
      scheduled_arrival_at: "2027-03-14T18:00:00Z",
    };
    const user = userEvent.setup();
    render(<EditFlightDialog flight={overnight} aircraft={[aircraft207]} zones={ZONES} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.change(screen.getByLabelText("Arrival (AKST)"), {
      target: { value: "2027-03-14T10:20" },
    });
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateFlightAction).toHaveBeenCalledWith(overnight.id, {
      scheduled_arrival_at: "2027-03-14T18:20:00Z",
    });
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

  it("says what came off the route before closing (#208)", async () => {
    refresh.mockReset();
    updateFlightAction.mockReset().mockResolvedValue({
      ok: true,
      offRoute: {
        stops: ["PAVA"],
        bookings: [
          {
            booking_id: "ae956651-eaca-4aeb-b35c-cfe34f5155f0",
            customer: "Ella Ramirez",
            origin: "PABE",
            destination: "PAVA",
            passengers: ["Ella Ramirez"],
          },
        ],
        lines: [
          {
            description: "USPS Bypass Mail",
            weight_lbs: "100.0",
            pieces: 2,
            mail_class: "bypass_mail",
            waiting_load_id: "w-1",
            station: "PABE",
            destination: "PAVA",
          },
        ],
        walk_ups: ["Sam Walkup"],
      },
    });
    const user = userEvent.setup();
    render(<EditFlightDialog flight={baseFlight} aircraft={[aircraft207, aircraft510]} />);
    await user.click(screen.getByRole("button", { name: /edit/i }));
    const paxInput = screen.getByLabelText(/passengers/i);
    await user.clear(paxInput);
    await user.type(paxInput, "3");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByRole("heading", { name: "GV101 no longer stops at PAVA" })).toBeInTheDocument();
    const back = screen.getByRole("region", { name: "Back on Awaiting a flight" });
    expect(back).toHaveTextContent("Ella Ramirez, PABE → PAVA");
    expect(screen.getByRole("link", { name: /^BK-/ })).toHaveAttribute(
      "href",
      "/reservations/bookings/ae956651-eaca-4aeb-b35c-cfe34f5155f0",
    );
    expect(screen.getByRole("region", { name: "Back on the waiting list" })).toHaveTextContent(
      "USPS Bypass Mail, 2 pieces, 100 lb: waiting at PABE for PAVA",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sam Walkup was added on the manifest with no booking, so stays on it.",
    );
    expect(refresh).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
