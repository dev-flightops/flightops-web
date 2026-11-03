import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FlightLoad } from "@/lib/api/manifest";
import type { FlightAssignmentResponse, FuelOrderResponse } from "@/lib/api/types";

import { Readiness } from "./readiness";

const tally = (count: number) => ({ count, weight_lbs: "0", baggage_lbs: "0" });
const load = (checkedIn: number, toCheckIn: number) =>
  ({ checked_in: tally(checkedIn), to_check_in: tally(toCheckIn) }) as unknown as FlightLoad;
const order = (status: string) =>
  ({ id: status, status, requested_quantity_gallons: 100, fuel_type_label_snapshot: "Jet A" }) as unknown as FuelOrderResponse;
const assignment = {
  id: "as-1",
  flight: { id: "fl-1", flight_number: "DEMO104", origin: "PANC", destination: "PABE", scheduled_departure_at: "2026-11-03T13:05:00Z", status: "released" },
  load_team: { id: "lt-1", team_name: "Anchorage Load Team A", base_icao: "PANC", color_code: "#60a5fa" },
  assigned_by: null,
  assigned_at: "2026-11-03T11:45:00Z",
  cleared_at: null,
  cleared_by: null,
  note: null,
  acknowledged_at: "2026-11-03T11:47:00Z",
  load_completed_at: "2026-11-03T11:58:00Z",
} as FlightAssignmentResponse;

function item(label: string) {
  return within(screen.getByText(label, { selector: "span.block" }).closest("li") as HTMLElement);
}

describe("Ready to go (#134)", () => {
  it("shows fuel, load and passengers, all done", () => {
    render(
      <Readiness
        fuelOrders={[order("cancelled"), order("fueled")]}
        assignment={assignment}
        flightLoad={load(3, 0)}
        timeZone="America/Anchorage"
      />,
    );
    expect(item("Fuel").getByText("Fueled")).toBeInTheDocument();
    expect(item("Load").getByText("Load complete")).toBeInTheDocument();
    expect(item("Passengers").getByText("3 of 3 checked in")).toBeInTheDocument();
  });

  it("says what is still to come", () => {
    render(
      <Readiness fuelOrders={[]} assignment={null} flightLoad={load(1, 2)} timeZone="America/Anchorage" />,
    );
    expect(item("Fuel").getByText("No fuel ordered")).toBeInTheDocument();
    expect(item("Load").getByText("No load team")).toBeInTheDocument();
    expect(item("Passengers").getByText("1 of 3 checked in")).toBeInTheDocument();
  });

  it("says unavailable rather than guessing when a read failed", () => {
    render(<Readiness fuelOrders={null} assignment={undefined} flightLoad={null} timeZone="America/Anchorage" />);
    expect(screen.getAllByText("Unavailable")).toHaveLength(3);
  });
});
