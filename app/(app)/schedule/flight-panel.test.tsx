import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FlightSheet } from "./actions";

const { flightSheetAction } = vi.hoisted(() => ({ flightSheetAction: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn(), ApiError: class ApiError extends Error {} }));
vi.mock("./actions", () => ({ flightSheetAction }));

import { FlightPanel, FlightPanelButton, type PanelFlight } from "./flight-panel";

const ZONES = { byIcao: { PABE: "America/Anchorage" }, fallback: "America/Anchorage" };

const FLIGHT: PanelFlight = { id: "f-1", flightNumber: "PGR790", stops: ["PABE", "9Z8", "PABE"], tail: "N100PA", state: "planned" };

function sheet(overrides: Partial<FlightSheet> = {}): FlightSheet {
  return {
    flight: {
      id: "f-1",
      flight_number: "PGR790",
      origin: "PABE",
      destination: "PABE",
      scheduled_departure_at: "2026-10-30T18:30:00Z",
      scheduled_arrival_at: "2026-10-30T21:15:00Z",
      status: "scheduled",
      aircraft: { id: "ac", tail_number: "N100PA", model: "Cessna 208 Caravan", seats: 9 },
      stops: ["PABE", "9Z8", "PABE"],
      legs: [
        { sequence: 1, origin: "PABE", destination: "9Z8", scheduled_departure_at: "2026-10-30T18:30:00Z", scheduled_arrival_at: "2026-10-30T19:45:00Z" },
        { sequence: 2, origin: "9Z8", destination: "PABE", scheduled_departure_at: "2026-10-30T20:00:00Z", scheduled_arrival_at: "2026-10-30T21:15:00Z" },
      ],
      pax_count: 0,
      cargo_lbs: 0,
      notes: null,
      max_payload_lbs: 3728,
      released_at: null,
      released_by: null,
    },
    names: { PABE: "Bethel", "9Z8": "Levelock" },
    base: "Bethel",
    bookings: {
      flight_id: "f-1",
      flight_number: "PGR790",
      route: ["PABE", "9Z8", "PABE"],
      seats_total: 9,
      legs: [
        { origin: "PABE", destination: "9Z8", held: 1, open: 8 },
        { origin: "9Z8", destination: "PABE", held: 0, open: 9 },
      ],
      bookings: [
        {
          id: "0e34ab7f-0000-4000-8000-000000000000",
          customer: { id: "c", full_name: "Jane Anderson", company_name: null },
          origin_icao: "PABE",
          destination_icao: "9Z8",
          requested_departure_at: "2026-10-30T17:00:00Z",
          pax_count: 1,
          status: "requested",
          notes: null,
          passengers: [{ id: "p", first_name: "Jane", last_name: "Anderson", weight_lbs: 165, notes: "Wheelchair assist", check_in_status: "checked_in" }],
        },
      ],
    },
    manifest: {
      pax: [{ id: "p", first_name: "Jane", last_name: "Anderson", weight_lbs: "165", baggage_lbs: "0", is_crew: false, check_in_status: "checked_in", boards_at: "PABE", leaves_at: "9Z8" }],
      cargo: [],
      load: { useful_load_lbs: 3728, crew_lbs: "0", fuel_lbs: "1361", fuel_counted: true },
    } as unknown as FlightSheet["manifest"],
    load: null,
    failed: [],
    ...overrides,
  } as FlightSheet;
}

beforeEach(() => flightSheetAction.mockReset());

/** #139: a flight opened on a leg, as the client's own system opens it. */
describe("the flight panel", () => {
  it("opens on the leg asked for: its airports, times and what it carries", async () => {
    flightSheetAction.mockResolvedValueOnce({ ok: true, data: sheet() });
    render(<FlightPanel flight={FLIGHT} leg={0} zones={ZONES} open onOpenChange={() => {}} />);
    const leg = await screen.findByRole("tabpanel", { name: "Leg 1, PABE to 9Z8" });
    expect(within(leg).getByText("Levelock")).toBeInTheDocument();
    expect(within(leg).getAllByText("10:30 AKDT").length).toBeGreaterThan(0);
    expect(within(leg).getByText("1 h 15 min")).toBeInTheDocument();
    expect(within(leg).getByRole("link", { name: /^Passengers: 1 checked in, 1 booked, 9 seats · 8 open$/ })).toHaveAttribute("href", "/manifest/f-1#passengers");
    expect(within(leg).getByRole("link", { name: /^Weight: 165 lb manifested, 2,202 lb available, 2,367 lb maximum$/ })).toHaveAttribute("href", "/manifest/f-1#load");
    expect(within(leg).getByText("BK-0E34AB7F")).toBeInTheDocument();
    expect(within(leg).getByText(/Wheelchair assist/)).toBeInTheDocument();
    expect(within(leg).getByRole("link", { name: "+ Add booking" })).toHaveAttribute(
      "href",
      "/reservations/bookings/new?flight=f-1&origin=PABE&destination=9Z8&date=2026-10-30T10%3A30&pax=1&return_to=%2Fmanifest%2Ff-1",
    );
  });

  it("has a tab for each leg, and the other leg adds bookings from there", async () => {
    flightSheetAction.mockResolvedValueOnce({ ok: true, data: sheet() });
    render(<FlightPanel flight={FLIGHT} leg={0} zones={ZONES} open onOpenChange={() => {}} />);
    await screen.findByRole("tabpanel");
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["PABE → 9Z8PGR790.1 · 10:30 AKDT", "9Z8 → PABEPGR790.2 · 12:00 AKDT"]);
    fireEvent.click(tabs[1]);
    const leg = screen.getByRole("tabpanel", { name: "Leg 2, 9Z8 to PABE" });
    expect(within(leg).getByRole("link", { name: /^Passengers: 0 checked in, 0 booked/ })).toBeInTheDocument();
    expect(within(leg).getByText("No bookings on this leg yet.")).toBeInTheDocument();
    expect(within(leg).getByRole("link", { name: "+ Add booking" }).getAttribute("href")).toContain("origin=9Z8&destination=PABE&date=2026-10-30T12%3A00");
  });

  it("says what didn't load, and when there is no useful load", async () => {
    const data = sheet({ failed: ["the flight's bookings"], bookings: null });
    (data.manifest as unknown as { load: object }).load = { useful_load_lbs: null, crew_lbs: "0", fuel_lbs: null };
    flightSheetAction.mockResolvedValueOnce({ ok: true, data });
    render(<FlightPanel flight={FLIGHT} leg={0} zones={ZONES} open onOpenChange={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t load the flight's bookings.");
    expect(screen.getByRole("link", { name: /^Weight: 165 lb manifested, useful load not set, Settings → Fleet$/ })).toBeInTheDocument();
  });

  it("says so when the flight can't be loaded", async () => {
    flightSheetAction.mockResolvedValueOnce({ ok: false, message: "The flight couldn't be loaded. Try again in a moment." });
    render(<FlightPanel flight={FLIGHT} leg={0} zones={ZONES} open onOpenChange={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The flight couldn't be loaded.");
  });

  it("opens from the list's flight number on the first leg", async () => {
    flightSheetAction.mockResolvedValueOnce({ ok: true, data: sheet() });
    render(<FlightPanelButton flight={FLIGHT} zones={ZONES} />);
    expect(flightSheetAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open flight PGR790" }));
    await waitFor(() => expect(screen.getByRole("tabpanel", { name: "Leg 1, PABE to 9Z8" })).toBeInTheDocument());
    expect(flightSheetAction).toHaveBeenCalledWith("f-1");
  });
});
