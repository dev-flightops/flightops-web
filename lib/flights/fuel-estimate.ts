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

/** "Fuel estimated: round trip, 55 min each way + 45 min reserve at 58
 *  gal/h = 149.9 gal of Jet A." */
export function fuelEstimateLine(e: FuelEstimate): string {
  const trip = e.round_trip
    ? `round trip, ${minutes(e.flight_minutes)} each way (no ${FUEL_LABELS[e.fuel_type_code ?? ""] ?? "fuel"} at the destination)`
    : `one way, ${minutes(e.flight_minutes)}`;
  const fuel = FUEL_LABELS[e.fuel_type_code ?? ""] ?? (e.fuel_type_code ?? "").toUpperCase();
  return `Fuel estimated: ${trip} + ${e.reserve_minutes} min reserve at ${Number(e.burn_gph)} gal/h = ${Number(e.gallons).toLocaleString()} gal of ${fuel}.`;
}
