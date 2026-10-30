/**
 * Typed wrappers around reservations-service endpoints (M3 slice 1).
 *
 * Backend: services/reservations/app/routes/{customers,bookings}.py
 */

import { apiFetch } from "./client";

// ============================================================================
// Customers
// ============================================================================

export type CustomerType =
  | "individual"
  | "corporate"
  | "government"
  | "non_profit";

export const CUSTOMER_TYPES: readonly CustomerType[] = [
  "individual",
  "corporate",
  "government",
  "non_profit",
] as const;

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  individual: "Individual",
  corporate: "Corporate",
  government: "Government",
  non_profit: "Non-Profit",
};

export interface Customer {
  id: string;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  customer_type: CustomerType;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerListResponse {
  items: Customer[];
  total: number;
}

export interface ListCustomersParams {
  q?: string;
  customer_type?: CustomerType;
  include_archived?: boolean;
  limit?: number;
  offset?: number;
}

/** The most customers one call may ask for: reservations-service's
 *  `limit` is `le=200`. The booking search asked for 500 from July (#160),
 *  every call answered 422, the page fell back to no customers, and its
 *  typeahead never listed anyone: the client's "no drop down of customers
 *  when I started typing" (#137). */
export const CUSTOMERS_MAX_LIMIT = 200;

function _customersQs(p: ListCustomersParams): string {
  const s = new URLSearchParams();
  if (p.q) s.set("q", p.q);
  if (p.customer_type) s.set("customer_type", p.customer_type);
  if (p.include_archived) s.set("include_archived", "true");
  if (p.limit !== undefined) s.set("limit", String(Math.min(p.limit, CUSTOMERS_MAX_LIMIT)));
  if (p.offset !== undefined) s.set("offset", String(p.offset));
  const qs = s.toString();
  return qs ? `?${qs}` : "";
}

export async function listCustomers(
  params: ListCustomersParams = {},
): Promise<CustomerListResponse> {
  return apiFetch<CustomerListResponse>(
    `/reservations/customers${_customersQs(params)}`,
  );
}

export async function getCustomer(customerId: string): Promise<Customer> {
  return apiFetch<Customer>(`/reservations/customers/${customerId}`);
}

export interface CreateCustomerInput {
  full_name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  customer_type?: CustomerType;
  notes?: string | null;
}

export async function createCustomer(
  input: CreateCustomerInput,
): Promise<Customer> {
  return apiFetch<Customer>("/reservations/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface UpdateCustomerInput {
  full_name?: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  customer_type?: CustomerType;
  notes?: string | null;
  archived?: boolean;
}

export async function updateCustomer(
  customerId: string,
  input: UpdateCustomerInput,
): Promise<Customer> {
  return apiFetch<Customer>(`/reservations/customers/${customerId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

// ============================================================================
// Bookings
// ============================================================================

export type BookingStatus =
  | "requested"
  | "quoted"
  | "confirmed"
  | "completed"
  | "cancelled";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "Requested",
  quoted: "Quoted",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export interface CustomerRef {
  id: string;
  full_name: string;
  company_name: string | null;
}

export interface AircraftRef {
  id: string;
  tail_number: string;
  model: string | null;
}

export interface UserRef {
  id: string;
  full_name: string;
  email: string;
}

/** The scheduled flight carrying a booking, when one is assigned. */
export interface BookingFlightRef {
  id: string;
  flight_number: string;
  origin: string;
  destination: string;
  scheduled_departure_at: string;
  status: string;
  /** The aircraft flying it (#150): the fleet board places the booking
   *  on that aircraft's row. */
  aircraft_id?: string | null;
  /** It has landed: what Complete waits for (#147). */
  landed?: boolean;
}

/** One person a booking is for (#137). On a flight they're a passenger on
 *  its manifest, where weights, seat and notes (wheelchair assist) are
 *  kept. */
export interface BookingPassenger {
  first_name: string;
  last_name: string;
  weight_lbs?: number | null;
  baggage_lbs?: number | null;
  notes?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
}

/** A booking's number as the screens show it, like a charter's CHR-. */
export function bookingRef(id: string): string {
  return `BK-${id.slice(0, 8).toUpperCase()}`;
}

export interface Booking {
  id: string;
  customer: CustomerRef;
  /**
   * Null until a dispatcher puts the booking on a flight.
   *
   * The API has returned this since M3 and this type did not declare
   * it, so every screen was blind to data it was already being sent —
   * which is part of why a reservation could sit unserviced with
   * nothing saying so.
   */
  flight: BookingFlightRef | null;
  origin_icao: string;
  destination_icao: string;
  requested_departure_at: string;
  estimated_arrival_at: string | null;
  aircraft: AircraftRef | null;
  pax_count: number;
  cargo_notes: string | null;
  quoted_total_cents: number | null;
  status: BookingStatus;
  notes: string | null;
  quoted_at: string | null;
  confirmed_at: string | null;
  confirmed_by: UserRef | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: UserRef | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
  /** Who it's for, as booked (#137); on a flight, its manifest has them.
   *  Absent from servers that predate it. */
  passengers?: BookingPassenger[];
  /** The other half of a return trip (#148). */
  paired_booking_id?: string | null;
}

export interface BookingListResponse {
  items: Booking[];
  total: number;
}

export interface ListBookingsParams {
  from_date?: string;
  to_date?: string;
  status?: BookingStatus;
  aircraft_id?: string;
  customer_id?: string;
  limit?: number;
  offset?: number;
  /** Only bookings with no flight assigned — the dispatch queue. */
  awaiting_flight?: boolean;
}

function _bookingsQs(p: ListBookingsParams): string {
  const s = new URLSearchParams();
  if (p.from_date) s.set("from_date", p.from_date);
  if (p.to_date) s.set("to_date", p.to_date);
  if (p.status) s.set("status", p.status);
  if (p.aircraft_id) s.set("aircraft_id", p.aircraft_id);
  if (p.customer_id) s.set("customer_id", p.customer_id);
  if (p.awaiting_flight) s.set("awaiting_flight", "true");
  if (p.limit !== undefined) s.set("limit", String(p.limit));
  if (p.offset !== undefined) s.set("offset", String(p.offset));
  const qs = s.toString();
  return qs ? `?${qs}` : "";
}

export async function listBookings(
  params: ListBookingsParams = {},
): Promise<BookingListResponse> {
  return apiFetch<BookingListResponse>(
    `/reservations/bookings${_bookingsQs(params)}`,
  );
}

export async function getBooking(bookingId: string): Promise<Booking> {
  return apiFetch<Booking>(`/reservations/bookings/${bookingId}`);
}

export interface CreateBookingInput {
  customer_id: string;
  origin_icao: string;
  destination_icao: string;
  requested_departure_at: string;
  estimated_arrival_at?: string | null;
  aircraft_id?: string | null;
  pax_count: number;
  cargo_notes?: string | null;
  quoted_total_cents?: number | null;
  notes?: string | null;
  /** Who it's for, by name (#137); sets pax_count. */
  passengers?: BookingPassenger[];
  /** The flight to put it on now (#137): from a search result, the
   *  schedule or the manifest. */
  flight_id?: string | null;
  /** A return trip (#148): the way back, filed as a second booking for
   *  the same customer and passengers. Both are filed, or neither. */
  return_trip?: {
    requested_departure_at: string;
    estimated_arrival_at?: string | null;
    flight_id?: string | null;
  } | null;
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<Booking> {
  return apiFetch<Booking>("/reservations/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface UpdateBookingInput {
  origin_icao?: string;
  destination_icao?: string;
  requested_departure_at?: string;
  estimated_arrival_at?: string | null;
  aircraft_id?: string | null;
  pax_count?: number;
  cargo_notes?: string | null;
  quoted_total_cents?: number | null;
  notes?: string | null;
  /** Who it's for while it waits for a flight (#137); on a flight, its
   *  manifest has them and this is refused. */
  passengers?: BookingPassenger[];
}

export async function updateBooking(
  bookingId: string,
  input: UpdateBookingInput,
): Promise<Booking> {
  return apiFetch<Booking>(`/reservations/bookings/${bookingId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** One field an edit changed (#147): times in ISO 8601, money in cents,
 *  the aircraft by tail number, the passengers by name. */
export interface BookingChange {
  id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_name: string | null;
  changed_at: string;
}

/** A booking's history of edits, newest first (#147). */
export async function getBookingChanges(bookingId: string): Promise<BookingChange[]> {
  return (
    await apiFetch<{ changes: BookingChange[] }>(`/reservations/bookings/${bookingId}/changes`)
  ).changes;
}

export async function quoteBooking(
  bookingId: string,
  quotedTotalCents: number,
): Promise<Booking> {
  return apiFetch<Booking>(`/reservations/bookings/${bookingId}/quote`, {
    method: "POST",
    body: JSON.stringify({ quoted_total_cents: quotedTotalCents }),
  });
}

export async function confirmBooking(bookingId: string): Promise<Booking> {
  return apiFetch<Booking>(`/reservations/bookings/${bookingId}/confirm`, {
    method: "POST",
  });
}

export async function completeBooking(bookingId: string): Promise<Booking> {
  return apiFetch<Booking>(`/reservations/bookings/${bookingId}/complete`, {
    method: "POST",
  });
}

export async function cancelBooking(
  bookingId: string,
  reason: string,
): Promise<Booking> {
  return apiFetch<Booking>(`/reservations/bookings/${bookingId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}


/**
 * Put a booking on a flight, or move it to a different one.
 *
 * The endpoint has existed since M3 with nothing calling it, which is
 * the whole of the 8/28 report: a reservation could be built and then
 * had no route onward.
 */
export async function assignBookingToFlight(
  bookingId: string,
  flightId: string,
): Promise<Booking> {
  return apiFetch<Booking>(
    `/reservations/bookings/${bookingId}/assign-flight`,
    {
      method: "POST",
      body: JSON.stringify({ flight_id: flightId }),
      headers: { "Content-Type": "application/json" },
    },
  );
}


/** One leg's seats (#137): held by bookings and the manifest's own
 *  passengers; open is null when the aircraft's seats aren't recorded. */
export interface LegSeatsView {
  origin: string;
  destination: string;
  held: number;
  open: number | null;
}

/** A booking's passenger as the flight's manifest has them now. */
export interface FlightBookingPassenger {
  id: string;
  first_name: string;
  last_name: string;
  weight_lbs: number;
  notes: string | null;
  check_in_status: string;
}

export interface FlightBooking {
  id: string;
  customer: CustomerRef;
  origin_icao: string;
  destination_icao: string;
  requested_departure_at: string;
  pax_count: number;
  status: BookingStatus;
  notes: string | null;
  /** On the manifest; empty for a booking from before that names nobody. */
  passengers: FlightBookingPassenger[];
}

/** A flight's bookings and seats leg by leg (#137): the schedule's flight
 *  panel. */
export interface FlightBookings {
  flight_id: string;
  flight_number: string;
  route: string[];
  seats_total: number;
  legs: LegSeatsView[];
  bookings: FlightBooking[];
}

export async function getFlightBookings(flightId: string): Promise<FlightBookings> {
  return apiFetch<FlightBookings>(`/reservations/flights/${flightId}/bookings`);
}

/** Bookings with no flight yet that this flight can carry on its day
 *  (#137), for "Add to this flight" on the manifest. */
export async function listWaitingBookings(flightId: string): Promise<BookingListResponse> {
  return apiFetch<BookingListResponse>(`/reservations/flights/${flightId}/waiting-bookings`);
}
