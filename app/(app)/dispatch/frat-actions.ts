"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { approveFrat } from "@/lib/api/ops";

export type AcceptOverLimitsState = {
  status: "idle" | "ok" | "error";
  message?: string;
  attempt: number;
};

/** The Chief Pilot or DO, with a reason, accepts what the flight's FRAT
 *  waits for: factors over company limits (#152) and a HIGH risk (#155).
 *  The API admits only them. */
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
    await approveFrat(flightId, reason);
  } catch (err) {
    if (err instanceof ApiError) {
      const message =
        err.status === 403
          ? "Only the Chief Pilot or the DO can approve this."
          : err.status === 409 && err.message.includes("frat_locked")
            ? "The flight is released: its FRAT can't change. Refresh the page."
            : err.status === 409
              ? "Nothing on the latest FRAT waits for approval now. Refresh the page."
              : err.status === 404
                ? "The pilot hasn't filed a FRAT for this flight."
                : `That was not saved (HTTP ${err.status}).`;
      return { status: "error", message, attempt };
    }
    return { status: "error", message: "Could not reach the ops service. Try again in a moment.", attempt };
  }
  revalidatePath("/dispatch");
  revalidatePath(`/frat/${flightId}`);
  revalidatePath("/flight-crew", "layout");
  return { status: "ok", attempt };
}
