"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assignFlightToTeam, unassignFlight } from "@/lib/api/ground";
import { ApiError } from "@/lib/api/client";

/**
 * Flight × load-team assignment (M2-M-25e), shared by the /ramp-ops
 * Assign team dropdown and the dispatch packet's Load Team panel. Both
 * change the same row, so both pages are revalidated. Each action takes
 * the useActionState shape: previous state, then the form data.
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

function _revalidate() {
  revalidatePath("/ramp-ops");
  revalidatePath("/dispatch");
}

/** ApiError carries the raw response body in `message`; FastAPI puts
 *  the reason in `detail`. */
function _detail(err: ApiError): string | null {
  try {
    const parsed = JSON.parse(err.message) as { detail?: unknown };
    return typeof parsed.detail === "string" ? parsed.detail : null;
  } catch {
    return null;
  }
}

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
      // The backend's 409 means one of two things. Every 409 used to
      // read as "inactive", which sent a dispatcher who lost a race
      // looking for a problem with the team.
      return {
        status: "error",
        message:
          _detail(err) === "assignment_conflict_retry"
            ? "Someone else assigned this flight at the same moment — refresh to see which team has it."
            : "That load team is inactive — pick another team.",
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
  _revalidate();
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
      _revalidate();
      return { status: "ok" };
    }
    return _apiError(err, "unassign");
  }
  _revalidate();
  return { status: "ok" };
}
