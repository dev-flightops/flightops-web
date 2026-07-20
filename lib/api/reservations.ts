/**
 * Typed wrappers around reservations-service endpoints (M3 slice 1).
 *
 * Backend: services/reservations/app/routes/{customers,bookings}.py
 */

import { apiFetch } from "./client";

// ============================================================================
// Customers
// ============================================================================

export interface Customer {
  id: string;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
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
  include_archived?: boolean;
  limit?: number;
  offset?: number;
}

function _customersQs(p: ListCustomersParams): string {
  const s = new URLSearchParams();
  if (p.q) s.set("q", p.q);
  if (p.include_archived) s.set("include_archived", "true");
  if (p.limit !== undefined) s.set("limit", String(p.limit));
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

export interface Booking {
  id: string;
  customer: CustomerRef;
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
}

function _bookingsQs(p: ListBookingsParams): string {
  const s = new URLSearchParams();
  if (p.from_date) s.set("from_date", p.from_date);
  if (p.to_date) s.set("to_date", p.to_date);
  if (p.status) s.set("status", p.status);
  if (p.aircraft_id) s.set("aircraft_id", p.aircraft_id);
  if (p.customer_id) s.set("customer_id", p.customer_id);
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
