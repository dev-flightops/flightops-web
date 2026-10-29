"use server";

import { revalidatePath } from "next/cache";

import { ApiError, SessionExpiredError } from "@/lib/api/client";
import { updateDutySettings } from "@/lib/api/ops";

/**
 * Settings → Duty Corrections (#100): who may correct anyone's duty
 * times. The Director of Operations or an Exec Admin sets it, as they
 * set the release policy. Called directly from the client component.
 */

export type DutySettingsResult = { ok: true } | { ok: false; error: string };

export async function saveDutySettingsAction(correctionRoles: string[]): Promise<DutySettingsResult> {
  try {
    await updateDutySettings(correctionRoles);
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return { ok: false, error: "Your session expired — please sign in again." };
    }
    if (err instanceof ApiError && err.status === 403) {
      return { ok: false, error: "Only the Director of Operations or an Exec Admin can change this." };
    }
    return {
      ok: false,
      error: err instanceof ApiError ? `The setting wasn't saved (HTTP ${err.status}).` : "The setting wasn't saved. Try again.",
    };
  }
  revalidatePath("/settings/duty");
  return { ok: true };
}
