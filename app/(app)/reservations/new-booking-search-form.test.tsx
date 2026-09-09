import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// The search runs through a server action. Mocked because the action
// reaches @/lib/api/client, which pulls the next-auth -> next/server
// chain into the test environment.
const searchFlights = vi.fn(async () => ({
  status: "ok" as const,
  data: {
    items: [],
    total: 0,
    origin: "PANC",
    destination: "PABE",
    search_date: "2026-08-20",
    pax_count: 1,
  },
}));
vi.mock("./actions", () => ({
  searchFlightsAction: (...args: unknown[]) => searchFlights(...(args as [])),
}));
vi.mock("@/lib/api/flight-search", () => ({
  UNAVAILABLE_REASON_LABELS: {
    insufficient_seats: "Not enough seats",
    already_departed: "Already departed",
  },
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

  it("runs a real search with the typed route", () => {
    render(<NewBookingSearchForm customers={[]} stations={STATIONS} />);
    fillRoute("panc", "pabe");
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));

    // Uppercased on the way out, so the backend gets canonical ICAOs.
    expect(searchFlights).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "panc", destination: "pabe" }),
    );
  });

  it("keeps a manual-booking escape hatch carrying the typed details", async () => {
    // A dispatcher whose flight is not in the results still needs to
    // file the booking, without retyping everything.
    render(<NewBookingSearchForm customers={[]} stations={STATIONS} />);
    fillRoute("panc", "pabe");
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));

    const link = await screen.findByRole("link", {
      name: /file the booking manually/i,
    });
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("/reservations/bookings/new?");
    // Uppercased on the way through, so the create form gets canonical ICAOs.
    expect(href).toContain("origin=PANC");
    expect(href).toContain("destination=PABE");
    expect(href).toContain("pax=1");
  });

  it("does not search when a later submit is invalid", () => {
    render(<NewBookingSearchForm customers={[]} stations={STATIONS} />);
    fillRoute("PANC", "PABE");
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));
    const callsAfterValid = searchFlights.mock.calls.length;

    fireEvent.change(screen.getByPlaceholderText("Destination ICAO"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));

    expect(searchFlights.mock.calls.length).toBe(callsAfterValid);
    expect(screen.getByText(/destination is required/i)).toBeInTheDocument();
  });
});

// ---- Airport identifiers ----------------------------------------------------
//
// The datalist suggests stations but does not confine the field to
// them, so a typo goes through as an airport. That is not cosmetic:
// origin and destination are what a booking is matched to a flight on,
// so "PANC`" produces a booking that can never be put on one — it sits
// in the dispatch queue reading "no flights scheduled on this route
// that day" for ever. One reached the live data that way.

describe("NewBookingSearchForm — airport identifiers", () => {
  // The mock is module-level and the suite above leaves calls on it.
  beforeEach(() => searchFlights.mockClear());

  function submitWith(origin: string, destination = "PABE") {
    render(<NewBookingSearchForm customers={[]} stations={STATIONS} />);
    fillRoute(origin, destination);
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));
  }

  it.each(["PANC`", "PA", "PANCX", "PA-C", "P@NC"])(
    "refuses %s as an origin",
    (bad) => {
      submitWith(bad);
      expect(
        screen.getByText(/origin should be an airport code/i),
      ).toBeInTheDocument();
      expect(searchFlights).not.toHaveBeenCalled();
    },
  );

  it("refuses a malformed destination too", () => {
    submitWith("PANC", "PABE`");
    expect(
      screen.getByText(/destination should be an airport code/i),
    ).toBeInTheDocument();
  });

  it.each(["PANC", "A61", "5KE", "BET"])("accepts %s", (good) => {
    // Three characters is the floor rather than four: plenty of the
    // strips this operation serves have no ICAO indicator and go by
    // their FAA designator, which can lead with a digit.
    submitWith(good);
    expect(
      screen.queryByText(/should be an airport code/i),
    ).not.toBeInTheDocument();
    expect(searchFlights).toHaveBeenCalled();
  });

  it("checks Via only when something is typed there", () => {
    render(<NewBookingSearchForm customers={[]} stations={STATIONS} />);
    fillRoute("PANC", "PABE");
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));
    expect(
      screen.queryByText(/via should be an airport code/i),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Stop"), {
      target: { value: "PA-C" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));
    expect(
      screen.getByText(/via should be an airport code/i),
    ).toBeInTheDocument();
  });

  it("caps every route field at four characters in the browser too", () => {
    // The JS check is the one that produces a sentence; this stops the
    // stray character being typed in the first place. The old cap was
    // ten, which is longer than any airport identifier.
    render(<NewBookingSearchForm customers={[]} stations={STATIONS} />);
    for (const placeholder of ["Origin ICAO", "Destination ICAO", "Stop"]) {
      expect(screen.getByPlaceholderText(placeholder)).toHaveAttribute(
        "maxlength",
        "4",
      );
    }
  });
});

// ---- When the search itself fails ------------------------------------------
//
// It always did. The form imported searchFlights straight from
// @/lib/api/flight-search, which goes through apiFetch — and apiFetch
// starts with `await auth()`, a server-only call. Every search a
// reservations agent ran threw and rendered "Couldn't search flights
// just now"; not one ever returned a result. It goes through a server
// action now, and the action says which kind of wrong it was.

describe("NewBookingSearchForm — when the search fails", () => {
  beforeEach(() => searchFlights.mockClear());

  function submit() {
    render(<NewBookingSearchForm customers={[]} stations={STATIONS} />);
    fillRoute("PANC", "PABE");
    fireEvent.click(screen.getByRole("button", { name: /search flights/i }));
  }

  it("says the session expired when that is what happened", async () => {
    searchFlights.mockResolvedValueOnce({
      status: "session_expired",
      message: "Your session has expired. Sign in again to search.",
    } as never);
    submit();
    expect(await screen.findByText(/session has expired/i)).toBeInTheDocument();
  });

  it("distinguishes a refusal from an unreachable service", async () => {
    searchFlights.mockResolvedValueOnce({
      status: "error",
      message: "Reservations refused the search (HTTP 422).",
    } as never);
    submit();
    expect(await screen.findByText(/HTTP 422/)).toBeInTheDocument();
  });

  it("still offers the manual route whichever way it failed", async () => {
    // The escape hatch is the whole reason a failed search is not a
    // dead end for the agent on the phone.
    searchFlights.mockResolvedValueOnce({
      status: "error",
      message: "Could not reach reservations-service.",
    } as never);
    submit();
    expect(
      await screen.findByText(/you can still file the booking manually/i),
    ).toBeInTheDocument();
  });
});
