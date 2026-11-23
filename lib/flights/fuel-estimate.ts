import type { FuelEstimate } from "@/lib/api/manifest";

/**
 * The trip fuel estimate's working in words (#75), on the manifest and
 * in the pilot's weight and balance (#111), so it can be checked.
 */

export const FUEL_LABELS: Record<string, string> = {
  jet_a: "Jet A",
  jet_a_plus: "Jet A+",
  jet_a1: "Jet A-1",
  "100ll": "100LL",
  mogas: "Mogas",
};

function minutes(m: number | null): string {
  if (m == null) return "?";
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
}

/** "Fuel estimated: round trip, 55 min each way + 50 min to the alternate
 *  PABE + 45 min reserve at 58 gal/h = 198.2 gal of Jet A." The alternate
 *  only for an IFR flight whose leg to it is worked out (#201). Fuel bought
 *  where the flight ends, the flight's own scheduled time: "one way" read
 *  wrong on PABE → PADM → PABE, which is round trip by its route (1119-16). */
export function fuelEstimateLine(e: FuelEstimate): string {
  const trip = e.round_trip
    ? `round trip, ${minutes(e.flight_minutes)} each way (no ${FUEL_LABELS[e.fuel_type_code ?? ""] ?? "fuel"} at the destination)`
    : `${minutes(e.flight_minutes)} as scheduled`;
  const alternate =
    e.alternate_minutes != null && e.alternate
      ? ` + ${minutes(e.alternate_minutes)} to the alternate ${e.alternate}`
      : "";
  const fuel = FUEL_LABELS[e.fuel_type_code ?? ""] ?? (e.fuel_type_code ?? "").toUpperCase();
  return `Fuel estimated: ${trip}${alternate} + ${e.reserve_minutes} min reserve at ${Number(e.burn_gph)} gal/h = ${Number(e.gallons).toLocaleString()} gal of ${fuel}.`;
}

/**
 * What the estimate leaves to the planner (#126): the reserve is 45
 * minutes on every flight, never below the legal minimum, as the GOM asks
 * for conservative planning. An IFR flight's estimate carries the fuel to
 * its alternate (#201), which the GOM says always to plan for; until it
 * can, the note says what it still needs.
 */
export function fuelPlanningNote(e: FuelEstimate, flight?: { is_ifr?: boolean } | null): string {
  const reserve = `The ${e.reserve_minutes} min reserve holds on every flight: never below the legal minimum, as the GOM asks for conservative planning.`;
  if (!(e.ifr ?? flight?.is_ifr)) return reserve;
  if (e.alternate_minutes != null && e.alternate) {
    return `${reserve} IFR: the fuel to the alternate ${e.alternate} is in it, as the GOM always plans.`;
  }
  if (e.alternate_missing) {
    return `${reserve} IFR: the fuel to the alternate isn't in it yet; it needs ${e.alternate_missing}.`;
  }
  // A service from before #201 sends no alternate.
  return `${reserve} IFR: add the fuel to your alternate, which the GOM says always to plan for.`;
}
