import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AircraftListItem } from "@/lib/api/types";

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
    expect(screen.getByText("Set N604PA’s cruise speed under Settings → Fleet to fill in the times.")).toBeInTheDocument();
    await userEvent.type(input("origin"), "pakn");
    await userEvent.type(input("destination"), "paai");
    expect(screen.getByText("Not on the Alaska airport list: type the times")).toBeInTheDocument();
  });
});
