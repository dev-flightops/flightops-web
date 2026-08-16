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

// ---- Validation + honest empty state ---------------------------------------
//
// This form cannot search: there is no flight-search endpoint yet. It
// used to router.push() to the create-booking form on submit, which
// reads as a broken search — you click Search, no results appear, and
// you are on a different page with no explanation. Legacy blocks a blank
// submit with "Enter origin, destination, and date"; we do the same and
// then say plainly why there are no results.

import { fireEvent } from "@testing-library/react";

function fillRoute(origin: string, destination: string) {
  fireEvent.change(screen.getByPlaceholderText("Origin ICAO"), {
    target: { value: origin },
  });
  fireEvent.change(screen.getByPlaceholderText("Destination ICAO"), {
    target: { value: destination },
  });
}

describe("NewBookingSearchForm — search behaviour", () => {
  it("blocks a blank submit and names every missing field", () => {
    render(<NewBookingSearchForm customers={[]} stations={STATIONS} />);
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));

    expect(screen.getByText(/origin is required/i)).toBeInTheDocument();
    expect(screen.getByText(/destination is required/i)).toBeInTheDocument();
  });

  it("never navigates away — the old behaviour that looked broken", () => {
    render(<NewBookingSearchForm customers={[]} stations={STATIONS} />);
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));
    fillRoute("PANC", "PABE");
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));

    expect(push).not.toHaveBeenCalled();
  });

  it("rejects a route whose destination equals its origin", () => {
    render(<NewBookingSearchForm customers={[]} stations={STATIONS} />);
    fillRoute("PANC", "panc");
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));

    expect(
      screen.getByText(/destination must differ from origin/i),
    ).toBeInTheDocument();
  });

  it("explains that search is unavailable rather than showing zero results", () => {
    // "No flights found" would be a lie — it would read as "this route
    // is empty on this date" when nothing was actually searched.
    render(<NewBookingSearchForm customers={[]} stations={STATIONS} />);
    fillRoute("PANC", "PABE");
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));

    expect(screen.getByRole("status")).toHaveTextContent(
      /flight search isn't available yet/i,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /does not mean there are no flights/i,
    );
  });

  it("carries the typed details into the booking link", () => {
    render(<NewBookingSearchForm customers={[]} stations={STATIONS} />);
    fillRoute("panc", "pabe");
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));

    const link = screen.getByRole("link", { name: /continue to new booking/i });
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("/reservations/bookings/new?");
    // Uppercased on the way through, so the create form gets canonical ICAOs.
    expect(href).toContain("origin=PANC");
    expect(href).toContain("destination=PABE");
    expect(href).toContain("pax=1");
  });

  it("clears the panel when a later submit is invalid", () => {
    render(<NewBookingSearchForm customers={[]} stations={STATIONS} />);
    fillRoute("PANC", "PABE");
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));
    expect(screen.getByRole("status")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Destination ICAO"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
