"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ApiError } from "@/lib/api/client";
import { pickMorningAircraft, recordMorningPreflight } from "@/lib/api/morning";

type Result = { ok: true } | { ok: false; error: string };
function refusal(error: unknown): Result {
  if (error instanceof ApiError) {
    try {
      const detail = JSON.parse(error.message).detail;
      if (typeof detail?.message === "string") return { ok: false, error: detail.message };
    } catch { /* Use a stable, readable fallback. */ }
    if (error.status === 403) return { ok: false, error: "Your account cannot record daily aircraft checks." };
    if (error.status === 401) return { ok: false, error: "Your session expired. Sign in again." };
  }
  return { ok: false, error: "Could not save the aircraft check. Refresh and try again." };
}
export async function takeAircraftAction(aircraftId: string): Promise<Result> {
  if (!z.string().uuid().safeParse(aircraftId).success) return { ok: false, error: "Choose an aircraft." };
  try { await pickMorningAircraft(aircraftId); }
  catch (error) { return refusal(error); }
  revalidatePath("/flight-crew");
  return { ok: true };
}
const schema = z.object({
  fuel_gallons: z.number().finite().min(0).max(9999).nullable(),
  oil_quarts: z.number().finite().min(0).max(99).nullable(),
  notes: z.string().max(2000).nullable(),
  completed: z.literal(true),
});
export async function saveMorningPreflightAction(id: string, body: {
  fuel_gallons: number | null; oil_quarts: number | null; notes: string | null; completed: boolean;
}): Promise<Result> {
  const parsed = schema.safeParse(body);
  if (!z.string().uuid().safeParse(id).success || !parsed.success) {
    return { ok: false, error: "Confirm the preflight and run-up, and check the fuel and oil quantities." };
  }
  try {
    const { fuel_gallons, oil_quarts, notes } = parsed.data;
    await recordMorningPreflight(id, { fuel_gallons, oil_quarts, notes });
  } catch (error) { return refusal(error); }
  revalidatePath("/flight-crew");
  revalidatePath("/flight-crew/preflight", "layout");
  return { ok: true };
}
