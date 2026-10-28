import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Customer } from "@/lib/api/reservations";

import { CustomerPicker } from "./customer-picker";
import { PassengerRows } from "./passenger-rows";

const ALICE = {
  id: "c-alice",
  full_name: "Alice Northrup",
  company_name: "Northrup Fisheries",
  email: null,
  phone: "907-555-0100",
} as unknown as Customer;

function hidden(name: string): string {
  return (document.querySelector(`input[type="hidden"][name="${name}"]`) as HTMLInputElement).value;
}

describe("the customer (#137)", () => {
  it("offers a caller who isn't on file as a new customer", () => {
    render(<CustomerPicker customers={[ALICE]} preselectCustomerId={null} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Phil Bass" } });
    expect(screen.getByRole("button", { name: "New customer: Phil Bass" })).toBeInTheDocument();
    expect(screen.getByText("Phil Bass isn't on file: filing the booking adds them as a customer.")).toBeInTheDocument();
    expect(hidden("new_customer_name")).toBe("Phil Bass");
    expect(hidden("customer_id")).toBe("");
  });

  it("finds one on file as you type, by name or company", () => {
    render(<CustomerPicker customers={[ALICE]} preselectCustomerId={null} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "fisheries" } });
    fireEvent.click(screen.getByRole("button", { name: /Alice Northrup/ }));
    expect(hidden("customer_id")).toBe("c-alice");
    expect(hidden("new_customer_name")).toBe("");
    expect(screen.getByRole("combobox")).toHaveValue("Alice Northrup");
  });

  it("keeps the name typed in the search", () => {
    render(<CustomerPicker customers={[ALICE]} preselectCustomerId={null} initialName="Phil Bass" />);
    expect(screen.getByRole("combobox")).toHaveValue("Phil Bass");
    expect(hidden("new_customer_name")).toBe("Phil Bass");
  });
});

describe("the passengers (#137)", () => {
  const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;

  it("starts the first with the customer's name until it's typed over", () => {
    const { rerender } = render(<PassengerRows initialCount={2} customerName="Alice Northrup" />);
    expect([value("Passenger 1 first name"), value("Passenger 1 last name")]).toEqual(["Alice", "Northrup"]);
    expect(value("Passenger 2 first name")).toBe("");
    expect(hidden("pax_count")).toBe("2");

    fireEvent.change(screen.getByLabelText("Passenger 1 first name"), { target: { value: "Tom" } });
    rerender(<PassengerRows initialCount={2} customerName="Alice Northrup Smith" />);
    expect([value("Passenger 1 first name"), value("Passenger 1 last name")]).toEqual(["Tom", "Northrup"]);
  });

  it("adds and removes passengers, and counts them", () => {
    render(<PassengerRows initialCount={1} customerName="" />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add passenger" }));
    expect(hidden("pax_count")).toBe("2");
    fireEvent.change(screen.getByLabelText("Passenger 2 notes"), { target: { value: "Wheelchair assist" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove passenger 1" }));
    expect(hidden("pax_count")).toBe("1");
    expect(value("Passenger 1 notes")).toBe("Wheelchair assist");
  });
});
