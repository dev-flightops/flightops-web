import type { FlightLoad, ManifestDetailResponse, ManifestPaxRow } from "@/lib/api/manifest";
import type { FlightBooking, FlightBookings } from "@/lib/api/reservations";

/**
 * What one leg of a flight carries (#139), for the schedule's flight
 * panel: the client's system shows, per leg, the passengers (checked in,
 * bookings, seats), the freight, and the weight (manifested, available,
 * maximum).
 *
 * Passengers count on the legs between where they board and leave, as
 * reservations and the manifest count seats. A freight or mail line
 * doesn't say where it comes off, so it counts on every leg.
 */
export interface LegSummary {
  /** 0-based, in flying order. */
  index: number;
  origin: string;
  destination: string;
  /** Checked in or boarded, crew aside. */
  checkedIn: number;
  /** Seats held on the leg, as reservations count them. */
  booked: number;
  open: number | null;
  seats: number | null;
  freightItems: number;
  freightLbs: number;
  /** Passengers and their bags on the leg, plus the freight. */
  manifestedLbs: number;
  /** The useful load less crew and fuel; null without a useful load. */
  maximumLbs: number | null;
  availableLbs: number | null;
  /** The fuel isn't known yet, so the maximum is before fuel. */
  beforeFuel: boolean;
  bookings: FlightBooking[];
}

/** The legs a span of the route covers: from where it starts to where
 *  it next reaches its end; the whole route when either isn't on it. */
export function legsCovered(stops: string[], from: string | null | undefined, to: string | null | undefined): number[] {
  const all = stops.slice(1).map((_, i) => i);
  if (!from || !to) return all;
  const start = stops.indexOf(from);
  if (start < 0 || start === stops.length - 1) return all;
  const end = stops.indexOf(to, start + 1);
  if (end < 0) return all;
  return all.slice(start, end);
}

const lbs = (value: string | number | null | undefined): number => {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const holdsSeat = (p: ManifestPaxRow) => !p.is_crew && p.check_in_status !== "no_show";
const checkedIn = (p: ManifestPaxRow) => !p.is_crew && (p.check_in_status === "checked_in" || p.check_in_status === "boarded");

export function legSummaries({
  stops,
  seats,
  bookings,
  manifest,
  load,
}: {
  stops: string[];
  seats: number | null;
  bookings: FlightBookings | null;
  manifest: ManifestDetailResponse | null;
  load: FlightLoad | null;
}): LegSummary[] {
  const legCount = Math.max(stops.length - 1, 0);
  const pax = manifest?.pax ?? [];
  const cargo = manifest?.cargo ?? [];
  const freightLbs = cargo.reduce((sum, c) => sum + lbs(c.weight_lbs), 0);
  const aboard = pax.map((p) => ({ p, legs: new Set(legsCovered(stops, p.boards_at, p.leaves_at)) }));
  const ride = (bookings?.bookings ?? []).map((b) => ({ b, legs: new Set(legsCovered(stops, b.origin_icao, b.destination_icao)) }));

  const capacity = load?.load ?? manifest?.load ?? null;
  const useful = capacity?.useful_load_lbs ?? null;
  const fuel = capacity?.fuel_lbs == null ? null : lbs(capacity.fuel_lbs);
  const maximum = useful == null ? null : Math.max(0, useful - lbs(capacity?.crew_lbs) - (fuel ?? 0));

  return Array.from({ length: legCount }, (_, index) => {
    const onLeg = aboard.filter((a) => a.legs.has(index)).map((a) => a.p);
    const view = bookings?.legs[index];
    const manifested = onLeg.filter(holdsSeat).reduce((sum, p) => sum + lbs(p.weight_lbs) + lbs(p.baggage_lbs), 0) + freightLbs;
    return {
      index,
      origin: stops[index],
      destination: stops[index + 1],
      checkedIn: onLeg.filter(checkedIn).length,
      booked: view?.held ?? onLeg.filter(holdsSeat).length,
      open: view?.open ?? (seats == null ? null : seats - onLeg.filter(holdsSeat).length),
      seats: bookings?.seats_total || seats,
      freightItems: cargo.length,
      freightLbs,
      manifestedLbs: manifested,
      maximumLbs: maximum,
      availableLbs: maximum == null ? null : maximum - manifested,
      beforeFuel: useful != null && fuel == null,
      bookings: ride.filter((r) => r.legs.has(index)).map((r) => r.b),
    };
  });
}
