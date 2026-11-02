import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(app)/dashboards/dispatcher/actions", () => ({ reassignAircraftAction: vi.fn() }));

import { AircraftTodayLine, AircraftTodayPanel } from "./aircraft-today-panel";

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

describe("AircraftTodayPanel: moving an aircraft (#93)", () => {
  it("offers dispatch to give an aircraft to another pilot, and no one else", () => {
    const pilots = [
      { id: "p-1", name: "Beth Nolan" },
      { id: "p-2", name: "Caleb Frost" },
    ];
    const { rerender } = render(<AircraftTodayPanel today={{ items: [ROW] }} pilots={pilots} />);
    const select = screen.getByLabelText("Give N701PS to");
    expect(within(select).queryByRole("option", { name: "Beth Nolan" })).toBeNull();
    expect(within(select).getByRole("option", { name: "Caleb Frost" })).toBeInTheDocument();
    rerender(<AircraftTodayPanel today={{ items: [ROW] }} />);
    expect(screen.queryByLabelText("Give N701PS to")).toBeNull();
  });
});

describe("AircraftTodayLine: the selected flight's aircraft on the packet (#134)", () => {
  it("says whose it is and when its preflight went on record", () => {
    render(<AircraftTodayLine tail="N701PS" aircraftId="a-1" today={{ items: [ROW] }} />);
    expect(screen.getByLabelText("Aircraft today")).toHaveTextContent(
      "N701PS is Beth Nolan's today; preflight and run-up at 08:05 AKDT · 60 gal, 9 qt.",
    );
  });

  it("says the flight can't be accepted while the preflight is missing", () => {
    render(<AircraftTodayLine tail="N701PS" aircraftId="a-1" today={{ items: [{ ...ROW, preflight_at: null }] }} />);
    expect(screen.getByLabelText("Aircraft today")).toHaveTextContent(/aren't on record yet, so the flight can't be accepted/);
  });

  it("says nobody has taken it", () => {
    render(<AircraftTodayLine tail="N704PS" aircraftId="a-9" today={{ items: [ROW] }} />);
    expect(screen.getByLabelText("Aircraft today")).toHaveTextContent("N704PS hasn't been taken today.");
  });
});

