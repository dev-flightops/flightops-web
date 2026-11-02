import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { AircraftListItem, FuelSupplierResponse, FuelTypeResponse } from "@/lib/api/types";
vi.mock("react", async (importOriginal) => ({ ...await importOriginal<typeof import("react")>(), useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false] }));
vi.mock("./actions", () => ({ createFuelOrderAction: vi.fn() }));
import { NewFuelOrderForm } from "./new-order-form";

it("keeps the operator's supplied date and explains a missing approved fuel type", () => {
  render(<NewFuelOrderForm today="2026-11-01" suppliers={[{ id: "s1", name: "Demo Fuel" } as FuelSupplierResponse]} fuelTypes={[{ id: "f1", code: "jet_a", label: "Jet A" } as FuelTypeResponse]} fleet={[{ id: "a1", tail_number: "NTEST", effective_fuel_type_code: "100ll", effective_fuel_capacity_gal: 80 } as AircraftListItem]} />);
  expect(screen.getByLabelText(/Requested Date/)).toHaveValue("2026-11-01");
  fireEvent.change(screen.getByLabelText(/Aircraft/), { target: { value: "NTEST" } });
  expect(screen.getByText(/No 100ll fuel type is configured/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Place fuel order" })).toBeDisabled();
});
