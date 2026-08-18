/**
 * Flight search — wraps reservations-service /flight-search
 * (flightops-services PR #165).
 *
 *   GET /reservations/flight-search?origin=&destination=&date=&pax_count=
 *
 * `is_available` is computed by the backend, not derived here. The UI
 * renders what it is told rather than re-deriving bookability from the
 * seat numbers: two implementations of the same rule drift, and the one
 * that matters is the one the server enforces. Same reasoning as the
 * dispatch release gate.
 *
 * No fare is returned. Legacy prices with route-fare load-factor tiers
 * and promotional fares; neither exists yet, and showing a made-up
 * number would be worse than showing none.
 */

import { apiFetch } from "./client";

export type UnavailableReason = "insufficient_seats" | "already_departed";

export interface FlightSearchResult {
  flight_id: string;
  flight_number: string;
  origin: string;
  destination: string;
  scheduled_departure_at: string;
  scheduled_arrival_at: string;
  status: string;
  aircraft_tail: string | null;
  aircraft_model: string | null;
  seats_total: number;
  seats_booked: number;
  seats_available: number;
  is_available: boolean;
  unavailable_reason: UnavailableReason | null;
}

export interface FlightSearchResponse {
  items: FlightSearchResult[];
  total: number;
  /** Echoed back so results can be captioned with the search that ran,
   *  not whatever is currently typed into the form. */
  origin: string;
  destination: string;
  search_date: string;
  pax_count: number;
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  date: string;
  paxCount?: number;
  showUnavailable?: boolean;
}

export async function searchFlights(
  params: FlightSearchParams,
): Promise<FlightSearchResponse> {
  const q = new URLSearchParams({
    origin: params.origin,
    destination: params.destination,
    date: params.date,
  });
  if (params.paxCount) q.set("pax_count", String(params.paxCount));
  if (params.showUnavailable) q.set("show_unavailable", "true");
  return apiFetch<FlightSearchResponse>(
    `/reservations/flight-search?${q.toString()}`,
  );
}

/** Why a listed flight can't be booked, in words a dispatcher can act on. */
export const UNAVAILABLE_REASON_LABELS: Record<UnavailableReason, string> = {
  insufficient_seats: "Not enough seats",
  already_departed: "Already departed",
};
