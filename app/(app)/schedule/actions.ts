"use server";

import { findAirport } from "@/lib/airports";
import { listCompanyBases } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Loads } from "@/lib/api/loads";
import { type FlightLoad, getFlightLoad, getFlightManifest, type ManifestDetailResponse } from "@/lib/api/manifest";
import { getFlight } from "@/lib/api/ops";
import { type FlightBookings, getFlightBookings } from "@/lib/api/reservations";
import type { FlightDetail } from "@/lib/api/types";

/** A flight's bookings and seats for the schedule's flight panel (#137). */
export async function flightBookingsAction(
  flightId: string,
): Promise<{ ok: true; data: FlightBookings } | { ok: false; message: string }> {
  try {
    return { ok: true, data: await getFlightBookings(flightId) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return { ok: false, message: "Your role can't see this flight's bookings." };
    }
    return { ok: false, message: "The flight's bookings couldn't be loaded. Try again in a moment." };
  }
}

/** Everything the schedule's flight panel shows, leg by leg (#139). */
export interface FlightSheet {
  flight: FlightDetail;
  /** Airport names by identifier, where known: the same Alaska table the
   *  new-flight form names airports from ("Levelock" for 9Z8). */
  names: Record<string, string>;
  /** The departure base's name ("Bethel"), when it is one of the company's. */
  base: string | null;
  bookings: FlightBookings | null;
  /** Null until the flight has a manifest. */
  manifest: ManifestDetailResponse | null;
  load: FlightLoad | null;
  /** What didn't load, to say so (#138). */
  failed: string[];
}

export async function flightSheetAction(
  flightId: string,
): Promise<{ ok: true; data: FlightSheet } | { ok: false; message: string }> {
  let flight: FlightDetail;
  try {
    flight = await getFlight(flightId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { ok: false, message: "This flight is no longer on the schedule." };
    return { ok: false, message: "The flight couldn't be loaded. Try again in a moment." };
  }
  const stops = flight.stops && flight.stops.length > 1 ? flight.stops : [flight.origin, flight.destination];
  const loads = new Loads();
  const [bookings, manifest, load, bases] = await Promise.all([
    loads.or(getFlightBookings(flightId), null, "the flight's bookings"),
    loads.or(getFlightManifest(flightId), null, "the manifest"),
    loads.or(getFlightLoad(flightId), null, "the flight's weights"),
    loads.or(listCompanyBases({ includeInactive: true }), null, "the company's bases"),
  ]);
  const names: Record<string, string> = {};
  for (const code of new Set(stops)) {
    const airport = findAirport(code);
    if (airport) names[code.toUpperCase()] = airport.name;
  }
  const base = bases?.items.find((b) => b.icao.toUpperCase() === flight.origin.toUpperCase());
  return {
    ok: true,
    data: { flight, names, base: base?.display_name ?? null, bookings, manifest, load, failed: loads.failed },
  };
}
