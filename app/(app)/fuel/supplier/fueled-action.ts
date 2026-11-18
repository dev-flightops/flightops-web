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

function gallonsOf(raw: string): number | null {
  const value = Number(raw);
  return raw.trim() === "" || !Number.isFinite(value) || value < 0 ? null : value;
}

/** `tanks` is what went into each tank of an order placed left and right,
 *  which is closed by tank (the client, 18 Nov: "if 25L and 25 R are on the
 *  order it should be confirmed for fuel balance requirements"). */
export async function markFueledAction(
  orderId: string,
  fueledByName: string,
  actualGallonsRaw: string,
  discrepancyReason: string,
  tanks?: { left: string; right: string },
): Promise<FueledActionResult> {
  const trimmedName = fueledByName.trim();
  const trimmedReason = discrepancyReason.trim();
  if (trimmedName === "") {
    return {
      status: "error",
      message: "Tell us who's reporting this fueling.",
    };
  }
  let went: { actual_quantity_gallons: number } | { actual_left_gallons: number; actual_right_gallons: number };
  if (tanks) {
    const left = gallonsOf(tanks.left);
    const right = gallonsOf(tanks.right);
    if (left === null || right === null) {
      return {
        status: "error",
        message: "Enter the gallons that went into each tank (0 or higher).",
      };
    }
    went = { actual_left_gallons: left, actual_right_gallons: right };
  } else {
    const actuals = gallonsOf(actualGallonsRaw);
    if (actuals === null) {
      return {
        status: "error",
        message: "Enter the actual gallons delivered (0 or higher).",
      };
    }
    went = { actual_quantity_gallons: actuals };
  }

  try {
    const order = await markSupplierFuelOrderFueled(orderId, {
      fueled_by_name: trimmedName,
      ...went,
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
        // The service's own sentence when it wrote one (a split order
        // closed by a total); otherwise a value out of range.
        let said = "";
        try {
          const detail = (JSON.parse(err.message) as { detail?: unknown }).detail;
          said = typeof detail === "string" ? detail : "";
        } catch {
          said = "";
        }
        return {
          status: "error",
          message: said || "Out of range — actuals must be 0 or higher.",
        };
      }
    }
    return { status: "error", message: "Couldn't mark fueled. Try again." };
  }
}
