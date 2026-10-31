"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  addDueItem,
  signOffDueItem,
  updateDueItem,
  type DueItemInput,
  type DueItemSignOff,
} from "@/lib/api/maintenance";

export type DueItemActionResult = { ok: true } | { ok: false; error: string };

/** What the maintenance service's refusals mean, in words for the form. */
const REFUSALS: Record<string, string> = {
  due_item_needs_a_due_or_interval:
    "Give it a due (hours or a date) or an interval to count from.",
  done_on_in_the_future: "The date it was done can't be after today.",
  due_item_retired: "This item was retired; it can't be signed off.",
  work_order_not_found: "That work order isn't on this aircraft.",
};

function message(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "Only maintenance (the DOM, a mechanic or an Exec Admin) can change the due list.";
    if (err.status === 404) return "That aircraft or item wasn't found.";
    try {
      const detail = (JSON.parse(err.message) as { detail?: unknown }).detail;
      if (typeof detail === "string" && REFUSALS[detail]) return REFUSALS[detail];
    } catch {
      // not JSON: fall through
    }
  }
  return fallback;
}

function refresh(aircraftId: string) {
  revalidatePath("/maintenance", "layout");
  revalidatePath(`/maintenance/aircraft/${aircraftId}`);
  revalidatePath("/dispatch", "layout");
}

export async function addDueItemAction(
  aircraftId: string,
  body: DueItemInput,
): Promise<DueItemActionResult> {
  try {
    await addDueItem(aircraftId, body);
    refresh(aircraftId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err, "Couldn't add the item. Try again in a moment.") };
  }
}

export async function signOffDueItemAction(
  aircraftId: string,
  itemId: string,
  body: DueItemSignOff,
): Promise<DueItemActionResult> {
  try {
    await signOffDueItem(itemId, body);
    refresh(aircraftId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err, "Couldn't record it. Try again in a moment.") };
  }
}

export async function retireDueItemAction(
  aircraftId: string,
  itemId: string,
): Promise<DueItemActionResult> {
  try {
    await updateDueItem(itemId, { is_active: false });
    refresh(aircraftId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err, "Couldn't retire it. Try again in a moment.") };
  }
}
