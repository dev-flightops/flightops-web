import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AircraftTodayPanel } from "./aircraft-today-panel";

const ROW = {
  id: "m-1",
  aircraft_id: "a-1",
  tail_number: "N701PS",
  pilot_user_id: "p-1",
  pilot_name: "Beth Nolan",
  company_date: "2026-10-31",
  picked_at: "2026-10-31T15:40:00Z",
  preflight_at: "2026-10-31T16:05:00Z",
  fuel_gallons: "60.0",
  oil_quarts: "9.0",
  notes: null,
  assigned_by_name: null,
};

describe("AircraftTodayPanel (#93)", () => {
  it("lists who took each aircraft and when its preflight went on record", () => {
    render(
      <AircraftTodayPanel
        today={{ items: [ROW, { ...ROW, id: "m-2", tail_number: "N703PS", pilot_name: "Caleb Frost", preflight_at: null, assigned_by_name: "Nadia Petrov" }] }}
      />,
    );
    const done = screen.getByRole("row", { name: /N701PS/ });
    expect(within(done).getByText("08:05 AKDT · 60 gal, 9 qt")).toBeInTheDocument();
    const waiting = screen.getByRole("row", { name: /N703PS/ });
    expect(within(waiting).getByText("Not yet")).toBeInTheDocument();
    expect(within(waiting).getByText("given by Nadia Petrov")).toBeInTheDocument();
  });

  it("says when nothing is taken yet, and when it couldn't load", () => {
    const { rerender } = render(<AircraftTodayPanel today={{ items: [] }} />);
    expect(screen.getByText(/No aircraft taken yet today/)).toBeInTheDocument();
    rerender(<AircraftTodayPanel today={null} />);
    expect(screen.getByText(/Couldn.t load today.s aircraft/)).toBeInTheDocument();
  });
});
