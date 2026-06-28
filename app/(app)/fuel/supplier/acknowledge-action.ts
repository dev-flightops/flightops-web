"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { acknowledgeSupplierFuelOrder } from "@/lib/api/ground";

/**
 * Server-action wrapper around `/fuel/supplier/orders/{id}/acknowledge`.
 *
 * The supplier types in WHO is acknowledging (their name / dispatch
 * desk identifier) plus an optional note (e.g. "truck dispatched
 * ETA 30min"). Empty/blank values become null so the audit row
 * carries a meaningful actor or none at all.
 */

export type AcknowledgeActionResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function acknowledgeOrderAction(
  orderId: string,
  confirmedByName: string,
  confirmedNote: string,
): Promise<AcknowledgeActionResult> {
  const trimmedName = confirmedByName.trim();
  const trimmedNote = confirmedNote.trim();
  if (trimmedName === "") {
    return {
      status: "error",
      message: "Tell us who's acknowledging this order.",
    };
  }
  try {
    await acknowledgeSupplierFuelOrder(
      orderId,
      trimmedName,
      trimmedNote === "" ? null : trimmedNote,
    );
    revalidatePath("/fuel/supplier");
    return { status: "ok" };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "error",
          message: "Your session expired — please sign in again.",
        };
      }
      if (err.status === 403) {
        return {
          status: "error",
          message:
            "This account isn't bound to a supplier. Contact your operations contact.",
        };
      }
      if (err.status === 404) {
        return {
          status: "error",
          message: "Order not found. It may have been cancelled.",
        };
      }
      if (err.status === 409) {
        return {
          status: "error",
          message:
            "This order isn't in 'ordered' status anymore — it may have already been acknowledged.",
        };
      }
    }
    return { status: "error", message: "Couldn't acknowledge. Try again." };
  }
}
