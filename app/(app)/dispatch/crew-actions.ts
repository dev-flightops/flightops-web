"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  assignFlightCrew,
  unassignFlightCrew,
  type CrewRole,
} from "@/lib/api/crew-assignments";

export type CrewActionResult = { ok: true } | { ok: false; error: string };

/** ApiError carries the raw response body in `message`, which for FastAPI
 *  is `{"detail": "..."}`. Worth digging out: the backend's 409s are
 *  written to be read by a person — "Ann Pilot is already PIC on PGR900"
 *  names who to stand down, where "conflict" would send the dispatcher
 *  hunting. */
function _detail(err: ApiError): string | null {
  try {
    const parsed = JSON.parse(err.message) as { detail?: unknown };
    return typeof parsed.detail === "string" && parsed.detail
      ? parsed.detail
      : null;
  } catch {
    return null;
  }
}

function _failure(err: unknown, verb: string): CrewActionResult {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return { ok: false, error: "Only dispatch can change a flight's crew." };
    }
    if (err.status === 409 || err.status === 404) {
      const detail = _detail(err);
      if (detail) return { ok: false, error: detail };
    }
    return { ok: false, error: `Couldn't ${verb} (HTTP ${err.status}).` };
  }
  return { ok: false, error: `Couldn't ${verb}. Try again.` };
}

export async function assignCrewAction(
  flightId: string,
  userId: string,
  crewRole: CrewRole,
): Promise<CrewActionResult> {
  try {
    await assignFlightCrew(flightId, { user_id: userId, crew_role: crewRole });
    revalidatePath("/dispatch");
    // The pilot's own page reads the same rows, and a dispatcher who
    // rosters someone expects them to see it without waiting for a cache
    // to lapse.
    revalidatePath("/flight-crew");
    return { ok: true };
  } catch (err) {
    return _failure(err, "assign that crew member");
  }
}

export async function unassignCrewAction(
  flightId: string,
  userId: string,
): Promise<CrewActionResult> {
  try {
    await unassignFlightCrew(flightId, userId);
    revalidatePath("/dispatch");
    revalidatePath("/flight-crew");
    return { ok: true };
  } catch (err) {
    return _failure(err, "remove that crew member");
  }
}
