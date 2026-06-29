"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { markSupplierFuelOrderFueled } from "@/lib/api/ground";

/**
 * Server-action wrapper around POST /fuel/supplier/orders/{id}/fueled.
 *
 * Used by the supplier inbox row's "Mark Fueled" control. Backend
 * auto-flips status to `discrepancy` when:
 *   - actuals differ from requested by > 5% (regardless of reason)
 *   - the supplier supplied an explicit discrepancyReason
 *
 * Either way the order moves to a terminal state; ramp doesn't need
 * to follow up.
 */

export type FueledActionResult =
  | { status: "ok"; resulting_status: "fueled" | "discrepancy" }
  | { status: "error"; message: string };

export async function markFueledAction(
  orderId: string,
  fueledByName: string,
  actualGallonsRaw: string,
  discrepancyReason: string,
): Promise<FueledActionResult> {
  const trimmedName = fueledByName.trim();
  const trimmedReason = discrepancyReason.trim();
  if (trimmedName === "") {
    return {
      status: "error",
      message: "Tell us who's reporting this fueling.",
    };
  }
  const actuals = Number(actualGallonsRaw);
  if (
    !Number.isFinite(actuals) ||
    actuals < 0 ||
    actualGallonsRaw.trim() === ""
  ) {
    return {
      status: "error",
      message: "Enter the actual gallons delivered (0 or higher).",
    };
  }

  try {
    const order = await markSupplierFuelOrderFueled(orderId, {
      fueled_by_name: trimmedName,
      actual_quantity_gallons: actuals,
      discrepancy_reason: trimmedReason === "" ? null : trimmedReason,
    });
    revalidatePath("/fuel/supplier");
    // The server may have auto-flipped to 'discrepancy' even when the
    // supplier intended a clean fueled close — surface that back to the
    // UI so the panel can render a clear "marked as discrepancy" note.
    const resulting_status =
      order.status === "discrepancy" ? "discrepancy" : "fueled";
    return { status: "ok", resulting_status };
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
            "Order needs to be acknowledged first before you can mark it fueled.",
        };
      }
      if (err.status === 422) {
        return {
          status: "error",
          message: "Out of range — actuals must be 0 or higher.",
        };
      }
    }
    return { status: "error", message: "Couldn't mark fueled. Try again." };
  }
}
