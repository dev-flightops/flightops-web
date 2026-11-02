"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { createFuelType, updateFuelType } from "@/lib/api/ground";
import { refusalText } from "@/lib/api/validation-errors";

/**
 * The fuel types catalog, kept in the web (#134): added, switched off and
 * on, as legacy's Fuel Types page kept it. For the fuel directory's
 * keepers (FUEL_CONFIG); the ground service checks that too.
 */

export interface FuelTypeResult {
  ok: boolean;
  error?: string;
}

function refused(err: unknown, fallback: string): FuelTypeResult {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return { ok: false, error: "Only the Chief Pilot, the Director of Maintenance, the Director of Operations or an Exec Admin can change the fuel types." };
    }
    try {
      const message = JSON.parse(err.message)?.detail?.message;
      if (typeof message === "string") return { ok: false, error: message };
    } catch {
      // not JSON: try the field reader below
    }
    const text = refusalText(err);
    if (text) return { ok: false, error: text };
  }
  return { ok: false, error: fallback };
}

/** A blank code is made from the label by the service ("Jet A + Prist" →
 *  JET_A_PRIST); the sort order defaults to legacy's 100. */
export async function addFuelTypeAction(form: {
  label: string;
  code: string;
  sort_order: string;
}): Promise<FuelTypeResult> {
  const label = form.label.trim();
  if (!label) return { ok: false, error: "Give the fuel type's label." };
  const sortText = form.sort_order.trim();
  const sortOrder = sortText === "" ? 100 : Number(sortText);
  if (!Number.isInteger(sortOrder)) return { ok: false, error: "The sort order is a whole number." };
  try {
    await createFuelType({ code: form.code.trim() || null, label, sort_order: sortOrder });
    revalidatePath("/fuel/types");
    return { ok: true };
  } catch (err) {
    return refused(err, "Couldn't add the fuel type. Try again in a moment.");
  }
}

export async function setFuelTypeActiveAction(typeId: string, active: boolean): Promise<FuelTypeResult> {
  try {
    await updateFuelType(typeId, { is_active: active });
    revalidatePath("/fuel/types");
    return { ok: true };
  } catch (err) {
    return refused(err, active ? "Couldn't switch the fuel type back on." : "Couldn't switch the fuel type off.");
  }
}
