import type { FuelSupplierBaseResponse } from "@/lib/api/types";
import { DEFAULT_TIME_ZONE, localToUtcIso, utcToLocalInput } from "@/lib/format/local-time";

/**
 * Aircraft model → fuel-type code, as legacy's spec has it:
 *   208 / 208B / King Air → JET-A
 *   207 / GA8 / PA-31     → 100LL
 * Anything else (including a null model — flightops-services migration
 * 0023 made aircraft.model nullable) is JET-A, legacy's default for
 * unknown turbine equipment.
 */
export function fuelTypeForAircraft(model: string | null): string {
  if (!model) return "JET-A";
  const normalized = model.toUpperCase();
  if (/(207|GA[\s-]?8|PA[\s-]?31)/.test(normalized)) return "100LL";
  return "JET-A";
}

/** One supplier-and-fuel choice for an order at a base. */
export interface FuelSupplierOption {
  key: string;
  supplierId: string;
  supplierName: string;
  fuelTypeId: string;
  fuelTypeLabel: string;
  pricePerGallon: number | null;
  isContract: boolean;
  isDefault: boolean;
}

/** The base's supplier rows for this aircraft's fuel, default first.
 *  Codes are stored as `jet_a` / `av_gas_100ll` while
 *  fuelTypeForAircraft says `JET-A` / `100LL`, so both are compared
 *  with separators stripped, on the end: the packet compared them for
 *  equality, and `AVGAS100LL` never equals `100LL`, so a 207's supplier
 *  never showed. */
export function supplierOptionsFor(
  rows: FuelSupplierBaseResponse[],
  fuelTypeCode: string,
): FuelSupplierOption[] {
  const norm = (code: string) => code.toUpperCase().replace(/[-_]/g, "");
  const wanted = norm(fuelTypeCode);
  return rows
    .filter((r) => r.is_active !== false && norm(r.fuel_type_code).endsWith(wanted))
    .sort((a, b) => Number(b.is_default) - Number(a.is_default))
    .map((r) => ({
      key: r.id,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      fuelTypeId: r.fuel_type_id,
      fuelTypeLabel: r.fuel_type_label,
      pricePerGallon: r.price_per_gallon,
      isContract: r.is_contract_rate,
      isDefault: r.is_default,
    }));
}

/**
 * When a "needed by HH:MM" falls: the last time the departure base's
 * clock reads that at or before the flight departs. The time is local
 * there (#68; it used to be UTC). Fuel is wanted before the flight, so
 * "needed by 23:50" for a 06:00 departure is the evening before.
 */
export function neededByInstant(
  departureIso: string,
  hhmm: string,
  timeZone: string = DEFAULT_TIME_ZONE,
): Date {
  const departs = new Date(departureIso);
  const day = utcToLocalInput(departureIso, timeZone).slice(0, 10);
  const on = (date: string) => new Date(localToUtcIso(`${date}T${hhmm}`, timeZone) ?? departureIso);
  const at = on(day);
  if (at <= departs) return at;
  const [y, m, d] = day.split("-").map(Number);
  return on(new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10));
}

/** The departure base's calendar date of an instant, "YYYY-MM-DD". */
export function localDate(iso: string, timeZone: string = DEFAULT_TIME_ZONE): string {
  return utcToLocalInput(iso, timeZone).slice(0, 10);
}
