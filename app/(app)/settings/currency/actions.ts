"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { createCurrencyItem, deactivateCurrencyItem, updateCurrencyItem } from "@/lib/api/ops";
import type { CurrencyIntervalType } from "@/lib/api/types";
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

// ---- Custom currency items (#134) --------------------------------------------

export interface CustomItemFormState {
  status: "idle" | "ok" | "error";
  message?: string;
  attempt: number;
}

const INTERVALS: readonly string[] = ["annual", "semi_annual", "rolling_days"];

function itemFailure(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired. Sign in again, then retry.";
    if (err.status === 403) return "Only a Chief Pilot, the Director of Operations or an Exec Admin can change this.";
    if (err.status === 404) return "That item is already gone. Refresh the page.";
    if (err.message.includes("currency_item_code_taken")) return "There is already a custom item with that name.";
    return `That was not saved (HTTP ${err.status}).`;
  }
  return "Could not reach the server. Try again in a moment.";
}

function revalidateItems() {
  revalidatePath("/settings/currency");
  revalidatePath("/compliance/crew-currency");
}

/** A count from the form: a whole number from 1 up to the limit, or null. */
function count(raw: FormDataEntryValue | null, limit: number): number | null {
  const n = Number(String(raw ?? "").trim());
  return Number.isInteger(n) && n > 0 && n <= limit ? n : null;
}

/**
 * Add a company item. Legacy asks for no code, so the code comes from the
 * name, in the defaults' form ("yk_delta_route_authorization").
 */
export async function addCustomItemAction(
  prev: CustomItemFormState,
  formData: FormData,
): Promise<CustomItemFormState> {
  const attempt = prev.attempt + 1;
  const fail = (message: string): CustomItemFormState => ({ status: "error", message, attempt });

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return fail("Enter the item's name.");
  if (name.length > 128) return fail("Keep the name under 128 characters.");
  const code = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
  if (!code) return fail("The name needs some letters or numbers.");
  const regulation = String(formData.get("regulation") ?? "").trim();
  if (!regulation) return fail("Enter what requires it, such as Company GOM 4.2.");
  if (regulation.length > 64) return fail("Keep the reference under 64 characters.");
  const interval = String(formData.get("interval_type") ?? "");
  if (!INTERVALS.includes(interval)) return fail("Pick how often it comes due.");

  let rolling: { rolling_days: number; rolling_threshold: number } | null = null;
  if (interval === "rolling_days") {
    const days = count(formData.get("rolling_days"), 3650);
    const times = count(formData.get("rolling_threshold"), 1000);
    if (days === null) return fail("Enter the rolling window in days, from 1 to 3650.");
    if (times === null) return fail("Enter how many it takes within the window, from 1 to 1000.");
    rolling = { rolling_days: days, rolling_threshold: times };
  }

  try {
    await createCurrencyItem({
      code,
      name,
      regulation,
      interval_type: interval as CurrencyIntervalType,
      ...rolling,
      is_check_event: formData.get("is_check_event") === "on",
      requires_examiner: formData.get("requires_examiner") === "on",
      is_initial_only: formData.get("is_initial_only") === "on",
    });
  } catch (err) {
    return fail(itemFailure(err));
  }
  revalidateItems();
  return { status: "ok", message: `Added ${name}.`, attempt };
}

export async function renameCustomItemAction(
  itemId: string,
  name: string,
  regulation: string,
): Promise<ActionResult> {
  const newName = name.trim();
  const newRegulation = regulation.trim();
  if (!newName || newName.length > 128) return { ok: false, error: "Enter a name under 128 characters." };
  if (!newRegulation || newRegulation.length > 64) {
    return { ok: false, error: "Enter a reference under 64 characters." };
  }
  try {
    await updateCurrencyItem(itemId, { name: newName, regulation: newRegulation });
  } catch (err) {
    return { ok: false, error: itemFailure(err) };
  }
  revalidateItems();
  return { ok: true };
}

/** Records already logged stay either way: an item is never deleted. */
export async function setCustomItemActiveAction(itemId: string, active: boolean): Promise<ActionResult> {
  try {
    if (active) await updateCurrencyItem(itemId, { is_active: true });
    else await deactivateCurrencyItem(itemId);
  } catch (err) {
    return { ok: false, error: itemFailure(err) };
  }
  revalidateItems();
  return { ok: true };
}
