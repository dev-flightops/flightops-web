import type { Booking } from "@/lib/api/reservations";
import type { AircraftListItem } from "@/lib/api/types";

export function bookingAircraftId(booking: Booking): string | null {
  return booking.flight?.aircraft_id ?? booking.aircraft?.id ?? null;
}

/** One capacity per flight, even when several bookings share it. */
export function seatCapacity(bookings: Booking[], aircraft: Map<string, AircraftListItem>): number {
  const counted = new Set<string>();
  return bookings.reduce((sum, booking) => {
    if (booking.status === "cancelled" || !booking.flight?.id) return sum;
    const key = booking.flight.id;
    if (counted.has(key)) return sum;
    counted.add(key);
    return sum + (aircraft.get(bookingAircraftId(booking) ?? "")?.seats ?? 0);
  }, 0);
}

export function matchesBooking(booking: Booking, query: string, aircraft: Map<string, AircraftListItem>): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const tail = aircraft.get(bookingAircraftId(booking) ?? "")?.tail_number;
  return [booking.id, `BK-${booking.id.slice(0, 8)}`, booking.customer.full_name,
    booking.customer.company_name, booking.flight?.flight_number, tail,
    booking.origin_icao, booking.destination_icao,
    ...(booking.passengers ?? []).map((p) => `${p.first_name} ${p.last_name}`),
  ].some((value) => value?.toLowerCase().includes(needle));
}

/** Overlapping bookings remain independently visible and clickable. */
export function bookingLanes(bookings: Booking[]): { byId: Map<string, number>; count: number } {
  const ends: number[] = [];
  const byId = new Map<string, number>();
  for (const b of [...bookings].sort((a, b) => Date.parse(a.requested_departure_at) - Date.parse(b.requested_departure_at))) {
    const start = Date.parse(b.requested_departure_at);
    const end = Math.max(start + 30 * 60_000, b.estimated_arrival_at ? Date.parse(b.estimated_arrival_at) : start + 2 * 60 * 60_000);
    let lane = ends.findIndex((previous) => previous <= start);
    if (lane < 0) lane = ends.length;
    ends[lane] = end;
    byId.set(b.id, lane);
  }
  return { byId, count: Math.max(1, ends.length) };
}

/** Waiting passengers do not occupy seats on an assigned aircraft. */
export function seatTotals(bookings: Booking[], aircraft: Map<string, AircraftListItem>) {
  const open = bookings.filter((b) => b.status !== "cancelled");
  const assigned = open.filter((b) => b.flight?.id);
  return {
    bookedSeats: assigned.reduce((sum, b) => sum + b.pax_count, 0),
    totalSeats: seatCapacity(assigned, aircraft),
    unassignedPax: open.filter((b) => !b.flight?.id).reduce((sum, b) => sum + b.pax_count, 0),
  };
}
