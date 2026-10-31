import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AircraftListItem } from "@/lib/api/types";

vi.mock("@/app/(app)/settings/fleet/actions", () => ({ updateAircraftAction: vi.fn() }));
// React 18 in tests has no useActionState; Next's React 19 does.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));

import { EditAircraftDialog } from "./edit-aircraft-dialog";

const CARAVAN: AircraftListItem = {
  id: "a-1",
  tail_number: "N100PA",
  model: "Cessna 208 Caravan",
  seats: 9,
  max_payload_lbs: 3728,
  is_active: true,
  make: "Cessna",
  serial_number: "208B0421",
  year: 2016,
  airframe_type: "caravan",
  max_gross_weight_lbs: 9062,
  empty_weight_lbs: 5334,
  cruise_speed_kt: 145,
  base: "PANC",
  special_notes: "Cargo pod fitted",
};

async function openFor(aircraft: AircraftListItem) {
  const user = userEvent.setup();
  render(<EditAircraftDialog aircraft={aircraft} />);
  await user.click(screen.getByRole("button", { name: "Edit" }));
  return user;
}

/** What Save would send: the form's fields, as the action receives them. */
function wouldSend(): Record<string, FormDataEntryValue> {
  const form = screen.getByRole("button", { name: "Save changes" }).closest("form");
  return Object.fromEntries(new FormData(form!).entries());
}

/**
 * Settings → Fleet's edit form (#115). It opened with the home base,
 * airframe slug and notes empty, so every save blanked them: two demo
 * Caravans lost their type, and with it the fuel estimate and the
 * release's checks by type.
 */
describe("EditAircraftDialog", () => {
  it("opens with what the aircraft has, base, type and notes included", async () => {
    await openFor(CARAVAN);
    expect(screen.getByLabelText("Home base ICAO")).toHaveValue("PANC");
    expect(screen.getByLabelText("Airframe slug")).toHaveValue("caravan");
    expect(screen.getByLabelText("Special notes")).toHaveValue("Cargo pod fitted");
  });

  it("sends the rest back as it was when only the seats change", async () => {
    const user = await openFor(CARAVAN);
    await user.clear(screen.getByLabelText("Passenger seats"));
    await user.type(screen.getByLabelText("Passenger seats"), "8");

    expect(wouldSend()).toEqual({
      aircraft_id: "a-1",
      model: "Cessna 208 Caravan",
      seats: "8",
      max_payload_lbs: "3728",
      base: "PANC",
      max_gross_weight_lbs: "9062",
      empty_weight_lbs: "5334",
      cruise_speed_kt: "145",
      year: "2016",
      make: "Cessna",
      serial_number: "208B0421",
      airframe_type: "caravan",
      special_notes: "Cargo pod fitted",
      // Nothing entered for its fuel and tanks (#156): its type's are used.
      fuel_type_code: "",
      fuel_capacity_gal: "",
    });
  });

  it("leaves a field empty where nothing is recorded", async () => {
    await openFor({ ...CARAVAN, base: null, airframe_type: undefined, special_notes: null });
    expect(screen.getByLabelText("Home base ICAO")).toHaveValue("");
    expect(screen.getByLabelText("Airframe slug")).toHaveValue("");
    expect(screen.getByLabelText("Special notes")).toHaveValue("");
  });
});
