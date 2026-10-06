"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { updateComplianceSettings } from "@/lib/api/type-qualifications";

/**
 * The company switch for aircraft qualifications at release (#46).
 *
 * Called directly from the card rather than as a form action: the unit
 * tests run React 18, which has neither useActionState nor function
 * form actions.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setTypeQualificationGateAction(
  enforce: boolean,
): Promise<ActionResult> {
  try {
    await updateComplianceSettings({ enforce_type_qualifications: enforce });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return { ok: false, error: "Your session expired — please sign in again." };
      }
      if (err.status === 403) {
        return {
          ok: false,
          error: "Only the Director of Operations or an Exec Admin can change this.",
        };
      }
      return { ok: false, error: `Couldn't save (HTTP ${err.status}). Try again.` };
    }
    return { ok: false, error: "Couldn't save. Try again." };
  }
  // Everything that reads the switch.
  for (const path of [
    "/settings/currency",
    "/dispatch",
    "/compliance/type-qualifications",
    "/crew",
  ]) {
    revalidatePath(path);
  }
  return { ok: true };
}
