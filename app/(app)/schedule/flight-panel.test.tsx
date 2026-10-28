import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { flightBookingsAction } = vi.hoisted(() => ({ flightBookingsAction: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn(), ApiError: class ApiError extends Error {} }));
vi.mock("./actions", () => ({ flightBookingsAction }));

import { FlightPanel } from "./flight-panel";

describe("a flight on the schedule, opened (#137)", () => {
  it("shows its seats leg by leg, its bookings, and where to add one", async () => {
    flightBookingsAction.mockResolvedValueOnce({
      ok: true,
      data: {
        flight_id: "f-1",
        flight_number: "6969",
        route: ["PABE", "9Z8", "PABE"],
        seats_total: 9,
        legs: [
          { origin: "PABE", destination: "9Z8", held: 1, open: 8 },
          { origin: "9Z8", destination: "PABE", held: 0, open: 9 },
        ],
        bookings: [
          {
            id: "d24a6ea3-0000-4000-8000-000000000000",
            customer: { id: "c", full_name: "Phil Bass", company_name: null },
            origin_icao: "PABE",
            destination_icao: "9Z8",
            requested_departure_at: "2026-10-27T17:00:00Z",
            pax_count: 1,
            status: "requested",
            notes: null,
            passengers: [
              { id: "p", first_name: "Phil", last_name: "Bass", weight_lbs: 190, notes: "Wheelchair assist", check_in_status: "booked" },
            ],
          },
        ],
      },
    });
    render(
      <FlightPanel
        flight={{
          id: "f-1",
          flightNumber: "6969",
          stops: ["PABE", "9Z8", "PABE"],
          departs: "Oct 27, 09:39 AKDT",
          departsLocal: "2026-10-27T09:39",
          tail: "N503PA",
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open flight 6969" }));
    await waitFor(() => expect(screen.getByText("BK-D24A6EA3")).toBeInTheDocument());
    expect(screen.getAllByText(/open/).map((n) => n.textContent)).toEqual(
      expect.arrayContaining(["8 open", "9 open"]),
    );
    expect(screen.getByText(/Wheelchair assist/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ Add booking" })).toHaveAttribute(
      "href",
      "/reservations/bookings/new?flight=f-1&origin=PABE&destination=9Z8&date=2026-10-27T09%3A39&pax=1&return_to=%2Fmanifest%2Ff-1",
    );
    expect(screen.getByRole("link", { name: "Open manifest" })).toHaveAttribute("href", "/manifest/f-1");
  });

  it("says when its bookings can't be loaded", async () => {
    flightBookingsAction.mockResolvedValueOnce({ ok: false, message: "The flight's bookings couldn't be loaded." });
    render(
      <FlightPanel
        flight={{ id: "f-2", flightNumber: "7000", stops: ["PABE", "PAEM"], departs: "", departsLocal: "", tail: "N1" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open flight 7000" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("couldn't be loaded"));
  });
});
