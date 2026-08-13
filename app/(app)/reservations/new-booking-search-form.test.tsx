import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import type { StationListItem } from "@/lib/api/types";

import { NewBookingSearchForm } from "./new-booking-search-form";

function station(
  icao_code: string,
  name: string,
  city: string | null = null,
): StationListItem {
  return {
    id: `st-${icao_code}`,
    icao_code,
    name,
    city,
    state: "AK",
    elevation_ft: null,
    has_reporting_function: true,
    station_type: "village_airport",
    is_hub: false,
    is_active: true,
    fuel_available: false,
    fuel_types_available: [],
    primary_fuel_supplier_id: null,
    runway_length_ft: null,
    runway_width_ft: null,
    runway_primary_name: null,
    runway_source: null,
    runway_cache_updated_at: null,
    latitude: null,
    longitude: null,
    notes: null,
    open_issue_count: 0,
  };
}

const STATIONS = [
  station("PANC", "Ted Stevens Anchorage Intl"),
  station("PABE", "Bethel Airport"),
  station("PAUN", "", "Unalakleet"),
];

describe("NewBookingSearchForm — station ICAO typeahead", () => {
  it("wires From/To/Via to the shared station datalist", () => {
    render(<NewBookingSearchForm customers={[]} stations={STATIONS} />);

    for (const placeholder of ["Origin ICAO", "Destination ICAO", "Stop"]) {
      expect(screen.getByPlaceholderText(placeholder)).toHaveAttribute(
        "list",
        "station-list",
      );
    }
  });

  it("renders one option per station, valued by bare ICAO", () => {
    const { container } = render(
      <NewBookingSearchForm customers={[]} stations={STATIONS} />,
    );

    const list = container.querySelector("datalist#station-list");
    expect(list).not.toBeNull();
    const options = Array.from(list!.querySelectorAll("option"));
    expect(options.map((o) => o.value)).toEqual(["PANC", "PABE", "PAUN"]);
    // Label carries the name so a dispatcher can search by airport name;
    // the committed value stays the bare ICAO.
    expect(options[0].textContent).toContain("Ted Stevens Anchorage Intl");
    // Falls back to city when the station has no name.
    expect(options[2].textContent).toContain("Unalakleet");
  });

  it("omits the datalist entirely when no stations loaded", () => {
    // ground-service unreachable → inputs must degrade to free text, not
    // render an empty dropdown.
    const { container } = render(
      <NewBookingSearchForm customers={[]} stations={[]} />,
    );
    expect(container.querySelector("datalist#station-list")).toBeNull();
    expect(screen.getByPlaceholderText("Origin ICAO")).toBeInTheDocument();
  });

  it("defaults stations to empty when the prop is omitted", () => {
    const { container } = render(<NewBookingSearchForm customers={[]} />);
    expect(container.querySelector("datalist#station-list")).toBeNull();
  });
});
