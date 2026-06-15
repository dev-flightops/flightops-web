"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assignFlightToTeam, unassignFlight } from "@/lib/api/ground";
import { ApiError } from "@/lib/api/client";

/**
 * /ramp-ops server actions for flight × load-team assignment (M2-M-25e).
 * Both submit a single hidden form post (no react useActionState — the
 * dropdown just calls these and waits) so the UI stays small.
 */

const AssignSchema = z.object({
  flight_id: z.string().uuid(),
  load_team_id: z.string().uuid(),
});

const UnassignSchema = z.object({
  flight_id: z.string().uuid(),
});

export type AssignActionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string };

function _apiError(err: unknown, verb: string): AssignActionState {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return {
        status: "error",
        message: "Your session expired — please sign in again.",
      };
    }
    if (err.status === 404) {
      return {
        status: "error",
        message:
          verb === "assign"
            ? "That flight or team isn't available — refresh and retry."
            : "Flight is already unassigned.",
      };
    }
    if (err.status === 409) {
      return {
        status: "error",
        message: "That load team is inactive — pick another team.",
      };
    }
    return {
      status: "error",
      message: `Couldn't ${verb} (HTTP ${err.status}). Try again.`,
    };
  }
  return { status: "error", message: `Couldn't ${verb}. Try again.` };
}

export async function assignFlightAction(
  _prev: AssignActionState,
  formData: FormData,
): Promise<AssignActionState> {
  const parsed = AssignSchema.safeParse({
    flight_id: formData.get("flight_id"),
    load_team_id: formData.get("load_team_id"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Invalid flight or team id." };
  }
  try {
    await assignFlightToTeam(parsed.data);
  } catch (err) {
    return _apiError(err, "assign");
  }
  revalidatePath("/ramp-ops");
  return { status: "ok" };
}

export async function unassignFlightAction(
  _prev: AssignActionState,
  formData: FormData,
): Promise<AssignActionState> {
  const parsed = UnassignSchema.safeParse({
    flight_id: formData.get("flight_id"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Invalid flight id." };
  }
  try {
    await unassignFlight(parsed.data.flight_id);
  } catch (err) {
    // 404 on unassign is acceptable — same end state.
    if (err instanceof ApiError && err.status === 404) {
      revalidatePath("/ramp-ops");
      return { status: "ok" };
    }
    return _apiError(err, "unassign");
  }
  revalidatePath("/ramp-ops");
  return { status: "ok" };
}
