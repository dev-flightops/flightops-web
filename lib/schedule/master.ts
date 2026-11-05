import type { ScheduleLeg } from "@/lib/api/master-schedule";

/** Client-safe helpers for the master schedule (#168). Days run as ops has
 *  them, Python's weekdays: 0 is Monday. */

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** "Daily", "Mon–Fri", "Sat–Sun", else "Mon · Wed · Fri", as legacy's
 *  `days_display` said them. */
export function daysText(days: readonly number[]): string {
  const set = [...new Set(days)].sort((a, b) => a - b);
  const key = set.join("");
  if (key === "0123456") return "Daily";
  if (key === "01234") return "Mon–Fri";
  if (key === "56") return "Sat–Sun";
  return set.map((d) => DAY_LABELS[d]).join(" · ");
}

/** "PANC → PABE → PANC". */
export function legsRoute(legs: readonly ScheduleLeg[]): string {
  if (legs.length === 0) return "";
  return [legs[0].origin, ...legs.map((leg) => leg.destination)].join(" → ");
}

/** A round trip: more than one leg, and home at the end. */
export function isRoundTrip(legs: readonly ScheduleLeg[]): boolean {
  return legs.length > 1 && legs[legs.length - 1].destination === legs[0].origin;
}

/** The day after an ISO day. */
export function nextDay(day: string): string {
  return shiftDay(day, 1);
}

export function previousDay(day: string): string {
  return shiftDay(day, -1);
}

function shiftDay(day: string, by: number): string {
  const at = new Date(`${day}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + by);
  return at.toISOString().slice(0, 10);
}
