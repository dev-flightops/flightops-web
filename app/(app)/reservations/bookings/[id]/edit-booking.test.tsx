import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Booking } from "@/lib/api/reservations";

vi.mock("./actions", () => ({
  updateBookingAction: vi.fn(),
  cancelAction: vi.fn(),
  completeAction: vi.fn(),
  confirmAction: vi.fn(),
  quoteAction: vi.fn(),
}));
// Next runs the forms on React 19; the test runner has React 18.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));

import { BookingHistory, historyValue } from "./booking-history";
import { EditBooking } from "./edit-booking";
import { LifecycleControls } from "./lifecycle-controls";

/**
 * Editing a booking (#147). The client, 29 Oct: "Need a way to edit
 * bookings after they are entered." Any stage but cancelled, as legacy;
 * each change kept with who made it. Complete once its flight has landed.
 */

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: "40a24f78-23ad-41f8-88f2-8f47270df930",
    customer: { id: "c-1", full_name: "Marcus Chen", company_name: "Coastal Freight LLC" },
    flight: null,
    origin_icao: "PABE",
    destination_icao: "PACK",
    requested_departure_at: "2026-10-29T17:00:00Z",
    estimated_arrival_at: null,
    aircraft: null,
    pax_count: 2,
    cargo_notes: null,
    quoted_total_cents: null,
    status: "confirmed",
    notes: null,
    quoted_at: null,
    confirmed_at: "2026-10-29T14:32:00Z",
    confirmed_by: null,
    completed_at: null,
    cancelled_at: null,
    cancelled_by: null,
    cancelled_reason: null,
    created_at: "2026-10-29T14:30:00Z",
    updated_at: "2026-10-29T14:32:00Z",
    passengers: [],
    ...over,
  };
}

const AIRCRAFT = [{ id: "a-1", tail_number: "N806PA", model: "Cessna 207 Skywagon" }];

function open(b: Booking) {
  render(
    <EditBooking booking={b} aircraft={AIRCRAFT} departureLocal="2026-10-29T09:00" zoneLabel="AKDT at PABE" />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit booking" }));
  return screen.getByRole("form", { name: "Edit booking" });
}

describe("EditBooking (#147)", () => {
  it("edits the route, departure, pax and notes of a booking waiting for a flight", () => {
    const form = open(booking());
    expect(within(form).getByLabelText("From")).toHaveValue("PABE");
    expect(within(form).getByLabelText("From")).toBeEnabled();
    expect(within(form).getByLabelText("Departure (AKDT at PABE)")).toHaveValue("2026-10-29T09:00");
    expect(within(form).getByLabelText("Pax")).toHaveValue(2);
    expect(within(form).getByRole("option", { name: "N806PA (Cessna 207 Skywagon)" })).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("edits a completed booking too, saying its changes are kept", () => {
    const form = open(booking({ status: "completed", completed_at: "2026-10-29T14:44:37Z" }));
    expect(within(form).getByText(/This booking is completed/)).toBeInTheDocument();
  });

  it("leaves who and the route to the manifest once its passengers are there", () => {
    const form = open(
      booking({
        flight: {
          id: "f-1",
          flight_number: "MM1122",
          origin: "PABE",
          destination: "PACK",
          scheduled_departure_at: "2026-10-29T17:33:00Z",
          status: "scheduled",
        },
        passengers: [
          { first_name: "Marcus", last_name: "Chen" },
          { first_name: "David", last_name: "Chen" },
        ],
      }),
    );
    expect(within(form).getByLabelText("From")).toBeDisabled();
    expect(within(form).queryByLabelText("Pax")).not.toBeInTheDocument();
    expect(within(form).getByText(/2 passengers are on MM1122's manifest/)).toBeInTheDocument();
    expect(within(form).getByRole("link", { name: /Open the manifest/ })).toHaveAttribute("href", "/manifest/f-1");
  });

  it("edits who a waiting booking is for, by name, and keeps each row's boxes when one goes", () => {
    const form = open(
      booking({
        passengers: [
          { first_name: "Marcus", last_name: "Chen", weight_lbs: 159 },
          { first_name: "David", last_name: "Chen" },
        ],
      }),
    );
    expect(within(form).getByLabelText("Passenger 1 weight (lb)")).toHaveValue("159");
    fireEvent.click(within(form).getAllByRole("button", { name: "Remove" })[0]);
    expect(within(form).getByLabelText("Passenger 1 first name")).toHaveValue("David");
    fireEvent.click(within(form).getByRole("button", { name: "+ Add passenger" }));
    expect(within(form).getByLabelText("Passenger 2 first name")).toHaveValue("");
  });
});

describe("BookingHistory (#147)", () => {
  it("lists each change with who made it", () => {
    render(
      <BookingHistory
        changes={[
          {
            id: "ch-1",
            field: "requested_departure_at",
            old_value: "2026-10-29T17:00:00+00:00",
            new_value: "2026-10-29T17:33:00+00:00",
            changed_by_name: "Peregrine Admin",
            changed_at: "2026-10-29T15:02:00Z",
          },
          {
            id: "ch-2",
            field: "notes",
            old_value: null,
            new_value: "Paid cash at the counter.",
            changed_by_name: "Peregrine Admin",
            changed_at: "2026-10-29T15:02:00Z",
          },
        ]}
      />,
    );
    expect(screen.getByText("Departure")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getAllByText(/by Peregrine Admin/)).toHaveLength(2);
  });

  it("writes money, times and nothing as the page shows them", () => {
    expect(historyValue("quoted_total_cents", "250000")).toBe("$2500.00");
    expect(historyValue("notes", null)).toBe("—");
    expect(historyValue("aircraft_id", "N806PA")).toBe("N806PA");
  });

  it("shows nothing without a change", () => {
    const { container } = render(<BookingHistory changes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("LifecycleControls: Complete waits for the flight to land (#147)", () => {
  it("offers Complete only once its flight has landed", () => {
    const { rerender } = render(
      <LifecycleControls bookingId="b-1" currentStatus="confirmed" currentQuoteCents={null} />,
    );
    expect(screen.queryByRole("button", { name: "Mark Completed" })).not.toBeInTheDocument();
    expect(screen.getByText("Complete it once its flight has landed.")).toBeInTheDocument();
    rerender(
      <LifecycleControls bookingId="b-1" currentStatus="confirmed" flightLanded currentQuoteCents={null} />,
    );
    expect(screen.queryByText("Complete it once its flight has landed.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Completed" })).toBeInTheDocument();
  });

  it("voids a booking completed before it flew, and nothing else once completed (#154)", () => {
    // Bob Kalskag's: completed on 3 Aug with no flight.
    const { rerender } = render(
      <LifecycleControls bookingId="b-1" currentStatus="completed" currentQuoteCents={null} />,
    );
    expect(screen.getByRole("heading", { name: "Void booking" })).toBeInTheDocument();
    expect(screen.getByText(/it never flew, so it can be voided/)).toBeInTheDocument();
    rerender(
      <LifecycleControls bookingId="b-1" currentStatus="completed" flightLanded currentQuoteCents={null} />,
    );
    expect(screen.queryByRole("heading", { name: "Void booking" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Cancel booking" })).not.toBeInTheDocument();
  });
});
