import type { FuelUnit } from "@/lib/api/types";

/**
 * How a pilot reads an aircraft's fuel and oil. The client, 17 Nov: "fuel
 * on turbines should be in LBS. Fuel on pistons can be in gallons. Turbine
 * oil measurement is typically annotated as full -1, -2 -3 qts low.
 * Pistons are reverse."
 *
 * The service says which from the aircraft's fuel (`fuel_unit`). None,
 * from an older service, reads as gallons, as every aircraft did before.
 */
export function fuelUnitOf(unit: FuelUnit | null | undefined): FuelUnit {
  return unit === "lb" ? "lb" : "gal";
}

/** A turbine's oil, as its dipstick reads: full, then quarts below it. */
export const OIL_QUARTS_LOW = [0, 1, 2, 3, 4, 5] as const;

export function oilLowOption(low: number): string {
  return low === 0 ? "Full" : `-${low}`;
}

type Reading = {
  fuel_lbs?: string | number | null;
  fuel_gallons?: string | number | null;
  oil_quarts_low?: string | number | null;
  oil_quarts?: string | number | null;
};

/**
 * A morning check's fuel and oil as recorded, for a summary line:
 * "2,100 lb, oil 2 qt low" on a turbine, "60 gal, 9 qt oil" on a piston.
 * Whatever was recorded is what shows, so a reading taken in gallons
 * before an aircraft read in pounds still says gallons.
 */
export function readingParts(row: Reading): string[] {
  const parts: string[] = [];
  if (row.fuel_lbs != null) parts.push(`${Number(row.fuel_lbs).toLocaleString("en-US")} lb`);
  else if (row.fuel_gallons != null) parts.push(`${Number(row.fuel_gallons)} gal`);
  if (row.oil_quarts_low != null) {
    const low = Number(row.oil_quarts_low);
    parts.push(low === 0 ? "oil full" : `oil ${low} qt low`);
  } else if (row.oil_quarts != null) {
    parts.push(`${Number(row.oil_quarts)} qt oil`);
  }
  return parts;
}
