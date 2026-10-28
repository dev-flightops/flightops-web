import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn(), ApiError: class ApiError extends Error {} }));
vi.mock("./actions", () => ({
  savePaxAction: vi.fn(),
  removeLineAction: vi.fn(),
}));

import type { ManifestPaxRow } from "@/lib/api/manifest";

import { PassengersSection } from "./pax-section";

function row(over: Partial<ManifestPaxRow>): ManifestPaxRow {
  return {
    id: "p-1",
    manifest_id: "m-1",
    first_name: "Phil",
    last_name: "Bass",
    weight_lbs: "190.0",
    baggage_lbs: "0.0",
    seat_number: null,
    ticket_type: "revenue",
    is_crew: false,
    is_unaccompanied_minor: false,
    contact_phone: null,
    contact_email: null,
    notes: null,
    check_in_status: "booked",
    booking_id: null,
    ...over,
  };
}

describe("a booked passenger on the manifest (#137)", () => {
  it("shows the booking and its note, and is taken off through the booking", () => {
    render(
      <PassengersSection
        flightId="f-1"
        editable
        stops={["PABE", "9Z8"]}
        rows={[
          row({ id: "p-1", booking_id: "d24a6ea3-0000-4000-8000-000000000000", notes: "Wheelchair assist" }),
          row({ id: "p-2", first_name: "Walk", last_name: "Up" }),
        ]}
      />,
    );
    const booked = screen.getByText("Bass").closest("tr") as HTMLElement;
    expect(within(booked).getByRole("link", { name: "BK-D24A6EA3" })).toHaveAttribute(
      "href",
      "/reservations/bookings/d24a6ea3-0000-4000-8000-000000000000",
    );
    expect(within(booked).getByText("Wheelchair assist")).toBeInTheDocument();
    expect(within(booked).getByRole("link", { name: "Booking ›" })).toBeInTheDocument();
    expect(within(booked).queryByRole("button", { name: "Remove" })).toBeNull();

    const walkUp = screen.getByText("Up").closest("tr") as HTMLElement;
    expect(within(walkUp).getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });
});
