import { apiFetch } from "./client";

/** A flight a booking with no flight could go on (LOG-05): from ops, with
 *  its seats and the payload left on the legs the party rides. */
export interface BookingFlight {
  flight_id: string;
  flight_number: string;
  route: string[];
  /** When the leg the party boards departs. */
  departs_at: string;
  aircraft_tail: string | null;
  seats_available: number;
  /** Null without the aircraft's useful load on file. */
  payload_left_lbs: string | null;
  fits: boolean;
  /** Why it doesn't: "seats" or "payload". */
  short_of?: "seats" | "payload" | null;
}

export interface BookingFlightsResponse {
  booking_id: string;
  pax_count: number;
  party_weight_lbs: string;
  items: BookingFlight[];
}

/** The flights that day on the booking's route, soonest first. */
export async function listBookingFlights(bookingId: string): Promise<BookingFlightsResponse> {
  return apiFetch<BookingFlightsResponse>(`/ops/bookings/${bookingId}/flights`);
}
