"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { reassignMorningAircraft } from "@/lib/api/ops";

export interface ReassignResult {
  ok: boolean;
  error?: string;
}

/** #93: "Dispatch can reassign": the aircraft, and its preflight, to another pilot today. */
export async function reassignAircraftAction(id: string, pilotUserId: string): Promise<ReassignResult> {
  try {
    await reassignMorningAircraft(id, pilotUserId);
    revalidatePath("/dashboards/dispatcher");
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) {
      try {
        const message = JSON.parse(err.message)?.detail?.message;
        if (typeof message === "string") return { ok: false, error: message };
      } catch {
        // not JSON: fall through to the plain sentence
      }
      if (err.status === 403) return { ok: false, error: "Only dispatch and the crew's managers can move an aircraft." };
    }
    return { ok: false, error: "Couldn't move the aircraft." };
  }
}
