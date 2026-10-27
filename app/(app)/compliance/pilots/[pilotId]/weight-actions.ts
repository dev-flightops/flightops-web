"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { setPilotWeight } from "@/lib/api/ops";

/**
 * A pilot's weight on their record, for weight and balance (#125). The
 * pilot themselves or a crew manager; the server decides which.
 */

export type WeightResult = { ok: true } | { ok: false; error: string };

const Weight = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 50 && v <= 500), {
    message: "Enter a whole number of pounds, 50 to 500.",
  });

export async function setPilotWeightAction(pilotId: string, weight: string): Promise<WeightResult> {
  const parsed = Weight.safeParse(weight);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await setPilotWeight(pilotId, parsed.data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 403)
      return { ok: false, error: "Only the pilot or a crew manager can change this." };
    if (err instanceof ApiError && err.status === 422)
      return { ok: false, error: "Enter a whole number of pounds, 50 to 500." };
    return { ok: false, error: "Couldn't save the weight. Try again." };
  }
  revalidatePath(`/compliance/pilots/${pilotId}`);
  return { ok: true };
}
