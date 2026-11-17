"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { signFrat } from "@/lib/api/ops";
import type { FratSignRole } from "@/lib/api/types";
import { signErrorMessage } from "@/lib/frat/signoff-text";

export type SignResult = { ok: true } | { ok: false; error: string };

/** The pilot's or a dispatcher's sign-off on the FRAT they read (#155).
 *  `changesReviewed`: the dispatcher has reviewed what the pilot changed
 *  (17 Nov), which signing the pilot's change needs. */
export async function signFratAction(
  flightId: string,
  assessmentId: string,
  role: FratSignRole,
  changesReviewed = false,
): Promise<SignResult> {
  try {
    await signFrat(flightId, assessmentId, role, changesReviewed);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) return { ok: false, error: "Your session expired — sign in again." };
      return { ok: false, error: signErrorMessage(err.message) };
    }
    return { ok: false, error: "Could not reach the ops service. Try again in a moment." };
  }
  revalidatePath(`/frat/${flightId}`);
  revalidatePath("/dispatch");
  revalidatePath("/flight-crew", "layout");
  return { ok: true };
}
