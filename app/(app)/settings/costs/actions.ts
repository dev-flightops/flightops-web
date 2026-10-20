"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { upsertAircraftCost, type AircraftCostInput } from "@/lib/api/auth";
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
