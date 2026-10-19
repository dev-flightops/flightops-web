import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));
vi.mock("./actions", () => ({ saveAircraftCostAction: vi.fn() }));

import type { AircraftCostRow } from "@/lib/api/auth";

import { AircraftTypeForm } from "./aircraft-type-form";

const CARAVAN: AircraftCostRow = {
  id: "r-1",
  aircraft_type: "Cessna 208B Grand Caravan",
  fuel_burn_gph: "58.00",
  fuel_type_code: "jet_a",
  engine_reserve_hr: "175.00",
  prop_reserve_hr: "25.00",
  maintenance_hr: "100.00",
  oil_consumables_hr: "12.00",
  pilot_daily_rate: "350.00",
  avg_duty_hrs: "8.0",
  insurance_hr: null,
};
// The model upper-cases new codes; the demo's older ones are lower case.
const FUELS = [
  { code: "JET_A", label: "Jet A" },
  { code: "100ll", label: "100LL Avgas" },
];

function renderForm() {
  render(<AircraftTypeForm rows={[CARAVAN]} fuelTypes={FUELS} fleetTypes={["Cessna 208B Grand Caravan", "Piper PA-31 Navajo"]} />);
}

const field = (name: string) => screen.getByRole("textbox", { name }) as HTMLInputElement;
// With its list of suggestions, the type field is a combobox.
const typeField = () => screen.getByRole("combobox", { name: "Aircraft type" }) as HTMLInputElement;
const fuel = () => screen.getByRole("combobox", { name: "Fuel" }) as HTMLSelectElement;

describe("AircraftTypeForm (#75)", () => {
  it("starts empty, as an add", () => {
    renderForm();
    expect(typeField().value).toBe("");
    expect(field("Fuel burn (gal/h)").value).toBe("");
    expect(fuel().value).toBe("");
    expect(screen.getByRole("button", { name: "Add aircraft type" })).toBeTruthy();
  });

  it("fills in a type already on the list, to edit it", () => {
    renderForm();
    fireEvent.change(typeField(), { target: { value: "Cessna 208B Grand Caravan" } });
    expect(field("Fuel burn (gal/h)").value).toBe("58.00");
    expect(field("Pilot pay $/day").value).toBe("350.00");
    expect(field("Insurance $/h").value).toBe("");
    expect(fuel().value).toBe("jet_a");
    expect(screen.getByRole("button", { name: "Save Cessna 208B Grand Caravan" })).toBeTruthy();
  });

  it("offers the company's fuels by code in lower case, and suggests types from the fleet", () => {
    renderForm();
    expect([...fuel().options].map((o) => [o.value, o.text])).toEqual([
      ["", "Not set"],
      ["jet_a", "Jet A"],
      ["100ll", "100LL Avgas"],
    ]);
    const suggestions = [...document.querySelectorAll("#aircraft-type-suggestions option")].map((o) =>
      o.getAttribute("value"),
    );
    expect(suggestions).toEqual(["Cessna 208B Grand Caravan", "Piper PA-31 Navajo"]);
  });
});
