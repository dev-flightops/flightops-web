"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { createComplianceOverride } from "@/lib/api/ops";

/**
 * M2-G-5 tail — supervisor override server action.
 *
 * Called by the OverrideDialog on the dispatch compliance gate.
 * Batches one POST /ops/compliance/overrides per hard-block currency
 * item so each block gets an audit row (Spec 5 §"Hard blocks":
 * "All overrides logged permanently to currency_overrides").
 *
 * Same cert number + reason applied to every block. That matches the
 * typical dispatcher-supervisor conversation: one override
 * conversation, N items covered by it.
 *
 * On success the caller (dispatcher) is expected to trigger release
 * with overrides_acknowledged=true — this action only records the
 * overrides; it doesn't release the flight (keeps the concerns
 * separated so an override can precede release by minutes without
 * accidentally auto-releasing).
 */

export type CreateOverridesResult =
  | { status: "ok"; count: number }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export async function createOverridesAction(
  pilotUserId: string,
  currencyItemIds: string[],
  supervisorCertNumber: string,
  reason: string,
  flightId: string | null,
): Promise<CreateOverridesResult> {
  const errors: Record<string, string> = {};
  if (!supervisorCertNumber.trim()) {
    errors.supervisor_cert_number = "Cert number is required.";
  }
  if (reason.trim().length < 50) {
    errors.reason = `Reason must be at least 50 characters (currently ${reason.trim().length}).`;
  }
  if (currencyItemIds.length === 0) {
    errors._ = "No hard-block items selected.";
  }
  if (Object.keys(errors).length > 0) {
    return { status: "field-errors", errors };
  }

  try {
    for (const itemId of currencyItemIds) {
      await createComplianceOverride({
        pilot_user_id: pilotUserId,
        currency_item_id: itemId,
        flight_id: flightId,
        supervisor_cert_number: supervisorCertNumber.trim(),
        reason: reason.trim(),
      });
    }
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "api-error",
          message: "Your session expired — please sign in again.",
        };
      }
      if (err.status === 403) {
        return {
          status: "api-error",
          message:
            "You don't have permission to record supervisor overrides.",
        };
      }
      if (err.status === 404) {
        return {
          status: "api-error",
          message: "Pilot or currency item not found — refresh the page.",
        };
      }
      return {
        status: "api-error",
        message: `Couldn't record override (HTTP ${err.status}). Try again.`,
      };
    }
    return {
      status: "api-error",
      message: "Couldn't record override. Try again in a moment.",
    };
  }

  revalidatePath("/dispatch/");
  if (flightId) revalidatePath(`/dispatch/${flightId}`);
  return { status: "ok", count: currencyItemIds.length };
}
