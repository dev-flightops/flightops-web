"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { acceptFratOverLimits } from "@/lib/api/ops";

export type AcceptOverLimitsState = {
  status: "idle" | "ok" | "error";
  message?: string;
  attempt: number;
};

/** The Chief Pilot or DO accepts a FRAT filed over company limits, with a
 *  reason (#152). The API admits only them. */
export async function acceptOverLimitsAction(
  prev: AcceptOverLimitsState,
  formData: FormData,
): Promise<AcceptOverLimitsState> {
  const attempt = prev.attempt + 1;
  const flightId = String(formData.get("flight_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(flightId)) {
    return { status: "error", message: "Refresh the page and try again.", attempt };
  }
  if (!reason) return { status: "error", message: "Say why the flight can go.", attempt };
  try {
    await acceptFratOverLimits(flightId, reason);
  } catch (err) {
    if (err instanceof ApiError) {
      const message =
        err.status === 403
          ? "Only the Chief Pilot or the DO can accept a FRAT over company limits."
          : err.status === 409 && err.message.includes("already")
            ? "It has been accepted already. Refresh the page."
            : err.status === 409
              ? "The pilot's latest FRAT is no longer over company limits. Refresh the page."
              : err.status === 404
                ? "The pilot hasn't filed a FRAT for this flight."
                : `That was not saved (HTTP ${err.status}).`;
      return { status: "error", message, attempt };
    }
    return { status: "error", message: "Could not reach the ops service. Try again in a moment.", attempt };
  }
  revalidatePath("/dispatch");
  revalidatePath("/flight-crew", "layout");
  return { status: "ok", attempt };
}
