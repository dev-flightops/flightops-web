"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { releaseFlight } from "@/lib/api/ops";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function releaseFlightAction(flightId: string): Promise<ActionResult> {
  try {
    await releaseFlight(flightId);
  } catch (err) {
    if (err instanceof ApiError) {
      // Map well-known backend detail strings to user-friendly messages
      if (err.message.includes("not_releasable_in_status_released")) {
        return { ok: false, error: "This flight has already been released." };
      }
      if (err.message.includes("not_releasable_in_status_cancelled")) {
        return { ok: false, error: "Cancelled flights cannot be released." };
      }
      if (err.message.includes("aircraft_not_active")) {
        return { ok: false, error: "The assigned aircraft is not active." };
      }
      return { ok: false, error: `Release failed (HTTP ${err.status}).` };
    }
    return { ok: false, error: "Release failed. Please try again." };
  }

  revalidatePath(`/dispatch/${flightId}`);
  revalidatePath("/dispatch");
  return { ok: true };
}
