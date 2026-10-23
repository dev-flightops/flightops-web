import { distanceNm, findAirport } from "@/lib/airports";
import { localToUtcIso, utcToLocalInput } from "@/lib/format/local-time";

/**
 * Leg times from the aircraft's cruise speed (#108).
 *
 * The client, 22 Oct: "if the system can build the times enroute based
 * of standard cruise speeds so the calendar and times can pre populate,
 * that takes a ton of work load off dispatchers building flights."
 *
 * Each leg is its great-circle distance at the cruise speed, rounded up
 * to the next 5 minutes; the next departs after the ground time at the
 * stop. No wind and no climb: a planning figure the dispatcher can
 * change, as legacy's dispatchers worked it in their heads.
 */

export interface PlannedLeg {
  from: string;
  to: string;
  /** Null when either airport isn't on the list. */
  nm: number | null;
  /** Null without a distance or a cruise speed. */
  minutes: number | null;
  /** Local at the departure base, as the form's inputs are. */
  departure: string | null;
  arrival: string | null;
}

/** Minutes for `nm` at `speedKt`, rounded up to the next 5, at least 5. */
export function legMinutes(nm: number, speedKt: number): number {
  return Math.max(5, Math.ceil(((nm / speedKt) * 60) / 5) * 5);
}

/** A typed local time plus `minutes`, in the same zone. */
export function addMinutes(local: string, minutes: number, timeZone: string): string | null {
  const iso = localToUtcIso(local, timeZone);
  if (!iso) return null;
  return utcToLocalInput(new Date(new Date(iso).getTime() + minutes * 60_000).toISOString(), timeZone);
}

/** Every leg of the route from the first departure. A leg that can't be
 *  worked out has no times, and nor has any leg after it. */
export function planLegs({
  airports,
  etd,
  speedKt,
  groundMinutes,
  timeZone,
}: {
  airports: string[];
  etd: string;
  speedKt: number | null | undefined;
  groundMinutes: number;
  timeZone: string;
}): PlannedLeg[] {
  const legs: PlannedLeg[] = [];
  let departure: string | null = etd || null;
  for (let i = 0; i + 1 < airports.length; i++) {
    const from = airports[i].trim().toUpperCase();
    const to = airports[i + 1].trim().toUpperCase();
    const a = findAirport(from);
    const b = findAirport(to);
    const nm = a && b ? distanceNm(a, b) : null;
    const minutes = nm != null && speedKt ? legMinutes(nm, speedKt) : null;
    const arrival = departure && minutes != null ? addMinutes(departure, minutes, timeZone) : null;
    legs.push({ from, to, nm, minutes, departure, arrival });
    departure = arrival ? addMinutes(arrival, groundMinutes, timeZone) : null;
  }
  return legs;
}

/** "84 nm · 35 min" for the form, or null when there is nothing to say. */
export function legSummary(leg: PlannedLeg | undefined): string | null {
  if (!leg || leg.nm == null) return null;
  const nm = `${Math.round(leg.nm)} nm`;
  return leg.minutes != null ? `${nm} · ${leg.minutes} min` : nm;
}
