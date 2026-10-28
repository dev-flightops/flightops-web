import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AircraftListItem } from "@/lib/api/types";
import { onScreenNotices } from "@/lib/help/on-screen";

vi.mock("./actions", () => ({ createFlightAction: vi.fn(async () => ({ status: "idle" })) }));
// Next runs the form on React 19; the test runner has React 18.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));

import { OpenFlightForm } from "./open-flight-form";

const CARAVAN: AircraftListItem = {
  id: "ac-1",
  tail_number: "N503PA",
  model: "Cessna 208B",
  seats: 9,
  max_payload_lbs: 3727,
  is_active: true,
  make: null,
  serial_number: null,
  year: null,
  cruise_speed_kt: 165,
};
const AIRVAN: AircraftListItem = { ...CARAVAN, id: "ac-2", tail_number: "N604PA", cruise_speed_kt: null };
const ZONES = { byIcao: { PABE: "America/Anchorage" }, fallback: "America/Anchorage" };

function renderForm() {
  return render(<OpenFlightForm aircraft={[CARAVAN, AIRVAN]} zones={ZONES} />);
}

const input = (name: string) => document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
const stopInputs = (name: string) =>
  Array.from(document.querySelectorAll(`input[name="${name}"]`)) as HTMLInputElement[];

describe("OpenFlightForm: a round trip by default, its times from the cruise speed (#108)", () => {
  it("adds the way home once there is a destination", async () => {
    renderForm();
    expect(screen.getByRole("checkbox", { name: /Round trip/ })).toBeChecked();
    await userEvent.type(input("origin"), "pabe");
    await userEvent.type(input("destination"), "paem");
    expect(stopInputs("stop_destination").map((i) => i.value)).toEqual(["PABE"]);
    expect(screen.getByText(/Leg 2 · from/)).toHaveTextContent("Leg 2 · from PAEM");

    await userEvent.click(screen.getByRole("checkbox", { name: /Round trip/ }));
    expect(stopInputs("stop_destination")).toHaveLength(0);
  });

  it("brings the way home to an origin typed over letter by letter (#132)", async () => {
    // The client, 23 Oct: "the leg two portion is not updating to PAKN".
    renderForm();
    await userEvent.type(input("origin"), "panc");
    await userEvent.type(input("destination"), "9z8");
    expect(stopInputs("stop_destination").map((i) => i.value)).toEqual(["PANC"]);

    await userEvent.clear(input("origin"));
    await userEvent.type(input("origin"), "pakn");
    expect(stopInputs("stop_destination").map((i) => i.value)).toEqual(["PAKN"]);
    expect(screen.getByRole("checkbox", { name: /Round trip: back to PAKN/ })).toBeChecked();
  });

  it("makes a way home sent elsewhere by hand an ordinary stop (#132)", async () => {
    renderForm();
    await userEvent.type(input("origin"), "pakn");
    await userEvent.type(input("destination"), "9z8");
    const home = stopInputs("stop_destination")[0];
    await userEvent.clear(home);
    await userEvent.type(home, "panc");
    expect(screen.getByRole("checkbox", { name: /Round trip/ })).not.toBeChecked();

    // The origin no longer moves it.
    await userEvent.clear(input("origin"));
    await userEvent.type(input("origin"), "pabe");
    expect(stopInputs("stop_destination").map((i) => i.value)).toEqual(["PANC"]);
  });

  it("fills the times in from the Caravan's 165 kt and the ground time", async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText(/Aircraft/), "ac-1");
    await userEvent.type(input("origin"), "pabe");
    await userEvent.type(input("destination"), "paem");
    fireEvent.change(input("scheduled_departure_at"), { target: { value: "2026-10-23T08:00" } });

    expect(input("scheduled_arrival_at").value).toBe("2026-10-23T08:55");
    expect(stopInputs("stop_departure")[0].value).toBe("2026-10-23T09:10");
    expect(stopInputs("stop_arrival")[0].value).toBe("2026-10-23T10:05");
    expect(screen.getByText(/^Emmonak · 1\d\d nm · 55 min$/)).toBeInTheDocument();
    expect(screen.getByText(/Times fill in at 165 kt, 15 min on the ground/)).toBeInTheDocument();

    // A longer stop moves the way home.
    fireEvent.change(input("ground_minutes"), { target: { value: "30" } });
    expect(stopInputs("stop_departure")[0].value).toBe("2026-10-23T09:25");
  });

  it("never overwrites a time typed by hand", async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText(/Aircraft/), "ac-1");
    await userEvent.type(input("origin"), "pabe");
    await userEvent.type(input("destination"), "paem");
    fireEvent.change(input("scheduled_departure_at"), { target: { value: "2026-10-23T08:00" } });
    fireEvent.change(input("scheduled_arrival_at"), { target: { value: "2026-10-23T09:30" } });
    fireEvent.change(input("scheduled_departure_at"), { target: { value: "2026-10-23T08:15" } });
    expect(input("scheduled_arrival_at").value).toBe("2026-10-23T09:30");
  });

  it("puts a stop added on a round trip before the way home", async () => {
    renderForm();
    await userEvent.type(input("origin"), "pabe");
    await userEvent.type(input("destination"), "paem");
    await userEvent.click(screen.getByRole("button", { name: "+ Add stop" }));
    const destinations = stopInputs("stop_destination");
    expect(destinations.map((i) => i.value)).toEqual(["", "PABE"]);
  });

  it("asks for the cruise speed, or for times by hand off the list", async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText(/Aircraft/), "ac-2");
    // #138: a setup notice, not a grey line, with who may set it.
    expect(screen.getByText(/N604PA’s cruise speed isn’t set, so the leg times can’t fill in\. Type each leg’s times\./)).toBeInTheDocument();
    expect(screen.getByText(/Ask an Exec Admin, the Director of Operations, the Director of Maintenance or Maintenance to set it under Settings → Fleet\./)).toBeInTheDocument();
    await userEvent.type(input("origin"), "pakn");
    await userEvent.type(input("destination"), "paai");
    expect(screen.getByText("Not on the Alaska airport list: type the times")).toBeInTheDocument();
  });
});

describe("OpenFlightForm: VFR unless marked IFR (#123)", () => {
  it("opens a flight VFR, with Flown IFR to tick", async () => {
    renderForm();
    const ifr = screen.getByRole("checkbox", { name: "Flown IFR" });
    expect(ifr).not.toBeChecked();
    expect(ifr).toHaveAttribute("name", "is_ifr");
    expect(screen.getByText(/Leave it unticked for a VFR flight/)).toBeInTheDocument();
    await userEvent.click(ifr);
    expect(ifr).toBeChecked();
  });
});

describe("OpenFlightForm: a charter's flight (#133)", () => {
  it("starts from the charter's request and carries it", () => {
    render(
      <OpenFlightForm
        aircraft={[CARAVAN, AIRVAN]}
        zones={ZONES}
        prefill={{
          flight_number: "CHR-9868A454",
          origin: "PABE",
          destination: "PAII",
          scheduled_departure_at: "2026-10-25T10:30",
          round_trip: false,
          pax_count: "5",
          cargo_lbs: "0",
          notes: "Charter for Alice Northrup",
          charter_request_id: "9868a454-cfa1-46ca-8c26-ed2de62953ee",
        }}
      />,
    );
    expect(input("flight_number")).toHaveValue("CHR-9868A454");
    expect(input("origin")).toHaveValue("PABE");
    expect(input("destination")).toHaveValue("PAII");
    expect(input("scheduled_departure_at")).toHaveValue("2026-10-25T10:30");
    expect(input("pax_count")).toHaveValue(5);
    expect(input("charter_request_id")).toHaveValue("9868a454-cfa1-46ca-8c26-ed2de62953ee");
    // One way: no return the same day.
    expect(screen.getByRole("checkbox", { name: /Round trip/ })).not.toBeChecked();
    expect(stopInputs("stop_destination")).toHaveLength(0);
  });
});

describe("OpenFlightForm: the company's ground time (#126)", () => {
  it("starts each stop's ground time at the company's, still changeable", () => {
    render(<OpenFlightForm aircraft={[CARAVAN, AIRVAN]} zones={ZONES} groundMinutesDefault={20} />);
    expect(input("ground_minutes")).toHaveValue(20);
    fireEvent.change(input("ground_minutes"), { target: { value: "25" } });
    expect(input("ground_minutes")).toHaveValue(25);
  });

  it("is 15 minutes without a company setting", () => {
    renderForm();
    expect(input("ground_minutes")).toHaveValue(15);
  });
});

describe("OpenFlightForm: says why it can't open (#138)", () => {
  it("marks an aircraft with no cruise speed in the list", () => {
    renderForm();
    expect(screen.getByRole("option", { name: "N604PA — Cessna 208B · no cruise speed: type the times" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "N503PA — Cessna 208B" })).toBeInTheDocument();
  });

  it("links a fleet editor to Settings → Fleet, and tells the assistant", async () => {
    render(<OpenFlightForm aircraft={[CARAVAN, AIRVAN]} zones={ZONES} canSetFleet />);
    await userEvent.selectOptions(screen.getByLabelText(/Aircraft/), "ac-2");
    expect(screen.getByRole("link", { name: "Set it under Settings → Fleet ›" })).toHaveAttribute("href", "/settings/fleet");
    expect(onScreenNotices()).toContain(
      "Setup needed: N604PA’s cruise speed isn’t set, so the leg times can’t fill in. Type each leg’s times. " +
        "It’s done under Settings → Fleet, by an Exec Admin, the Director of Operations, the Director of Maintenance or Maintenance.",
    );
  });

  it("says which times stop the submit, and why they're empty", async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText(/Aircraft/), "ac-2");
    await userEvent.type(input("origin"), "pabe");
    await userEvent.type(input("destination"), "9z8");
    fireEvent.change(input("scheduled_departure_at"), { target: { value: "2026-10-29T10:30" } });
    expect(screen.queryByText(/Can’t open yet/)).not.toBeInTheDocument();

    // What the browser does on Open Flight with a required box empty.
    fireEvent.invalid(input("scheduled_arrival_at"));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Leg 1 ETA, Leg 2 ETD, Leg 2 ETA are empty. N604PA has no cruise speed, so they can’t fill in: type them.",
    );
    expect(onScreenNotices().some((n) => n.startsWith("Can’t open the flight yet: Leg 1 ETA, Leg 2 ETD"))).toBe(true);

    // Typed in, the notice goes.
    fireEvent.change(input("scheduled_arrival_at"), { target: { value: "2026-10-29T11:10" } });
    for (const name of ["stop_departure", "stop_arrival"]) {
      fireEvent.change(stopInputs(name)[0], { target: { value: "2026-10-29T11:30" } });
    }
    expect(screen.queryByText(/Can’t open yet/)).not.toBeInTheDocument();
  });
});
