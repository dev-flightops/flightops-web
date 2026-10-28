import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn(), ApiError: class ApiError extends Error {} }));
vi.mock("./actions", () => ({ addBookingAction: vi.fn() }));

import type { Booking } from "@/lib/api/reservations";

import { WaitingBookings } from "./waiting-bookings";

const BOOKING = {
  id: "d24a6ea3-0000-4000-8000-000000000000",
  customer: { id: "c", full_name: "Alice Northrup", company_name: null },
  origin_icao: "PABE",
  destination_icao: "9Z8",
  pax_count: 1,
  status: "confirmed",
  passengers: [{ first_name: "Phil", last_name: "Bass" }],
} as unknown as Booking;

describe("bookings waiting for this flight (#137)", () => {
  it("lists them by number with Add to this flight", () => {
    render(<WaitingBookings flightId="f-1" bookings={[BOOKING]} newBookingHref="/new?flight=f-1" canAdd />);
    expect(screen.getByRole("link", { name: /BK-D24A6EA3/ })).toHaveAttribute(
      "href",
      `/reservations/bookings/${BOOKING.id}`,
    );
    expect(screen.getByText("Phil Bass")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to this flight" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ New booking on this flight" })).toHaveAttribute(
      "href",
      "/new?flight=f-1",
    );
  });

  it("says when none is waiting", () => {
    render(<WaitingBookings flightId="f-1" bookings={[]} newBookingHref="/new" canAdd />);
    expect(screen.getByText(/no booking on this route that day is waiting/)).toBeInTheDocument();
  });
});
