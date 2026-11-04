"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  deleteCostRow,
  saveFuelPrice,
  saveLandingFee,
  saveRouteTime,
  upsertAircraftCost,
  type AircraftCostInput,
  type CostRowKind,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export interface CostFormState {
  status: "idle" | "ok" | "error";
  message?: string;
  attempt: number;
}

const NUMBER_FIELDS = [
  "fuel_burn_gph",
  "engine_reserve_hr",
  "prop_reserve_hr",
  "maintenance_hr",
  "oil_consumables_hr",
  "pilot_daily_rate",
  "avg_duty_hrs",
  "insurance_hr",
] as const;

const _optionalNumber = z
  .string()
  .trim()
  .transform((v) => v.replace(/[$,]/g, ""))
  .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), "Enter numbers of 0 or more.")
  .transform((v) => (v === "" ? null : v));

/**
 * Add an aircraft type's operating costs, or change one (#75). The API
 * replaces the row's cost fields with what is sent, so the form sends them
 * all; the fuel type is how the load plan weighs the type's burn.
 */
export async function saveAircraftCostAction(prev: CostFormState, formData: FormData): Promise<CostFormState> {
  const attempt = prev.attempt + 1;
  const fail = (message: string): CostFormState => ({ status: "error", message, attempt });
  const type = String(formData.get("aircraft_type") ?? "").trim();
  if (!type) return fail("Enter the aircraft type.");
  if (type.length > 80) return fail("Keep the aircraft type under 80 characters.");
  const body: AircraftCostInput = {
    aircraft_type: type,
    fuel_type_code: String(formData.get("fuel_type_code") ?? "").trim() || null,
    fuel_burn_gph: null,
    engine_reserve_hr: null,
    prop_reserve_hr: null,
    maintenance_hr: null,
    oil_consumables_hr: null,
    pilot_daily_rate: null,
    avg_duty_hrs: null,
    insurance_hr: null,
  };
  for (const field of NUMBER_FIELDS) {
    const parsed = _optionalNumber.safeParse(String(formData.get(field) ?? ""));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the numbers.");
    body[field] = parsed.data;
  }
  try {
    await upsertAircraftCost(body);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) return fail("Your session expired. Sign in again, then retry.");
      if (err.status === 403) return fail("Only an Exec Admin can change operating costs.");
      if (err.message.includes("unknown_fuel_type")) return fail("That fuel isn't one of the company's fuel types.");
      return fail(`That was not saved (HTTP ${err.status}).`);
    }
    return fail("Could not reach the server. Try again in a moment.");
  }
  revalidatePath("/settings/costs");
  return { status: "ok", message: `Saved ${type}.`, attempt };
}

/** An airport as the API takes it: 3 or 4 letters and digits (9Z8, PABE). */
function airport(raw: FormDataEntryValue | null): string | null {
  const code = String(raw ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{3,4}$/.test(code) ? code : null;
}

function plainNumber(raw: FormDataEntryValue | null): string | null {
  const cleaned = String(raw ?? "").trim().replace(/[$,]/g, "");
  return cleaned !== "" && Number.isFinite(Number(cleaned)) && Number(cleaned) >= 0 ? cleaned : null;
}

function savedFail(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired. Sign in again, then retry.";
    if (err.status === 403) return "Only an Exec Admin can change operating costs.";
    if (err.status === 404) return "That row is already gone. Refresh the page.";
    return `That was not saved (HTTP ${err.status}).`;
  }
  return "Could not reach the server. Try again in a moment.";
}

/** Saving a base and fuel already priced replaces its price. */
export async function saveFuelPriceAction(prev: CostFormState, formData: FormData): Promise<CostFormState> {
  const attempt = prev.attempt + 1;
  const fail = (message: string): CostFormState => ({ status: "error", message, attempt });
  const icao = airport(formData.get("icao_code"));
  if (!icao) return fail("Enter the base's airport code, such as PABE or 9Z8.");
  const price = plainNumber(formData.get("price_per_gal"));
  if (price === null || Number(price) <= 0) return fail("Enter a price above $0.");
  const fuel = String(formData.get("fuel_type") ?? "").trim();
  if (!fuel) return fail("Pick the fuel.");
  try {
    await saveFuelPrice({ icao_code: icao, price_per_gal: price, fuel_type: fuel });
  } catch (err) {
    return fail(savedFail(err));
  }
  revalidatePath("/settings/costs");
  return { status: "ok", message: `Saved ${fuel} at ${icao}.`, attempt };
}

/** Saving an airport already on the list replaces its fee. */
export async function saveLandingFeeAction(prev: CostFormState, formData: FormData): Promise<CostFormState> {
  const attempt = prev.attempt + 1;
  const fail = (message: string): CostFormState => ({ status: "error", message, attempt });
  const icao = airport(formData.get("icao_code"));
  if (!icao) return fail("Enter the airport code, such as PABE or 9Z8.");
  const fee = plainNumber(formData.get("fee_amount"));
  if (fee === null) return fail("Enter the fee in dollars, 0 or more.");
  const notes = String(formData.get("notes") ?? "").trim();
  if (notes.length > 200) return fail("Keep the notes under 200 characters.");
  try {
    await saveLandingFee({ icao_code: icao, fee_amount: fee, notes: notes || null });
  } catch (err) {
    return fail(savedFail(err));
  }
  revalidatePath("/settings/costs");
  return { status: "ok", message: `Saved the fee at ${icao}.`, attempt };
}

/** Saving a route already on the list replaces its time. */
export async function saveRouteTimeAction(prev: CostFormState, formData: FormData): Promise<CostFormState> {
  const attempt = prev.attempt + 1;
  const fail = (message: string): CostFormState => ({ status: "error", message, attempt });
  const origin = airport(formData.get("origin_icao"));
  const dest = airport(formData.get("dest_icao"));
  if (!origin || !dest) return fail("Enter both airport codes, such as PABE or 9Z8.");
  const hours = plainNumber(formData.get("est_flight_hrs"));
  if (hours === null || Number(hours) <= 0) return fail("Enter the flight time in hours, above 0.");
  try {
    await saveRouteTime({ origin_icao: origin, dest_icao: dest, est_flight_hrs: hours });
  } catch (err) {
    return fail(savedFail(err));
  }
  revalidatePath("/settings/costs");
  return { status: "ok", message: `Saved ${origin} to ${dest}.`, attempt };
}

export async function removeCostRowAction(
  kind: CostRowKind,
  rowId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await deleteCostRow(kind, rowId);
  } catch (err) {
    return { ok: false, error: savedFail(err) };
  }
  revalidatePath("/settings/costs");
  return { ok: true };
}
