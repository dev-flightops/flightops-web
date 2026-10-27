"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  updateComplianceSettings,
  updateFirstClassMedicalTypes,
  updateNotStartedBlocks,
} from "@/lib/api/type-qualifications";

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

/** The aircraft types whose PIC needs a first-class medical (#87). */
export async function setFirstClassMedicalTypesAction(
  airframeTypes: string[],
): Promise<ActionResult> {
  try {
    await updateFirstClassMedicalTypes(airframeTypes);
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
      if (err.status === 400) {
        return { ok: false, error: "One of those types is not in the fleet any more. Reload and try again." };
      }
      return { ok: false, error: `Couldn't save (HTTP ${err.status}). Try again.` };
    }
    return { ok: false, error: "Couldn't save. Try again." };
  }
  for (const path of ["/settings/currency", "/dispatch", "/crew"]) {
    revalidatePath(path);
  }
  return { ok: true };
}

/** Whether a currency record never entered blocks release (#99). Off, it
 *  is a warning the dispatcher acknowledges; on, the pilot isn't offered
 *  for the seat and release is refused until it's entered. */
export async function setNotStartedBlocksAction(blocks: boolean): Promise<ActionResult> {
  try {
    await updateNotStartedBlocks(blocks);
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
  for (const path of ["/settings/currency", "/dispatch", "/compliance/crew-currency"]) {
    revalidatePath(path);
  }
  return { ok: true };
}
