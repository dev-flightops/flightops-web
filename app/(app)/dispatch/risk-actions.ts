"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  patchDispatchRiskInputs,
  type DispatchRiskInputsPatch,
} from "@/lib/api/dispatch-risk";

export type SaveRiskResult = { ok: true } | { ok: false; error: string };

/** Save some of the dispatcher's risk answers (#50). The page re-scores
 *  the flight on the refresh that follows. */
export async function saveRiskInputsAction(
  flightId: string,
  patch: DispatchRiskInputsPatch,
): Promise<SaveRiskResult> {
  try {
    await patchDispatchRiskInputs(flightId, patch);
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return { ok: false, error: "Only a dispatcher or Exec Admin can change the risk inputs." };
    }
    if (err instanceof ApiError && err.status === 422) {
      return { ok: false, error: "That value isn't accepted. Check it and try again." };
    }
    if (err instanceof ApiError && err.status === 404) {
      return { ok: false, error: "This flight no longer exists. Refresh the page." };
    }
    return { ok: false, error: "Couldn't save. Check the connection and try again." };
  }
  revalidatePath("/dispatch");
  return { ok: true };
}
