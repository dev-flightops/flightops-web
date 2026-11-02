"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { clockIn, clockOut, pickMorningAircraft, recordMorningPreflight } from "@/lib/api/ops";

export interface DutyActionResult {
  ok: boolean;
  /** Short message the duty button shows inline on failure. */
  error?: string;
  /** On clock-in: it reopened the duty day rather than starting one. */
  resumed?: boolean;
  clockInAt?: string;
}

/**
 * Server actions wrapping the duty endpoints so the client button
 * doesn't have to call the server-only `apiFetch` directly.
 *
 * Each action revalidates /flight-crew/ on success so the page's
 * server-side fetch of the current duty state picks up the new row
 * on next paint.
 *
 * Errors are mapped to short user-facing strings; the button
 * surfaces them inline.
 */

export async function clockInAction(
  args: { rest_acknowledged?: boolean } = {},
): Promise<DutyActionResult> {
  try {
    const period = await clockIn({ rest_acknowledged: args.rest_acknowledged });
    revalidatePath("/flight-crew");
    return {
      ok: true,
      resumed: period.resumed === true,
      clockInAt: period.clock_in_at,
    };
  } catch (err) {
    return { ok: false, error: mapError(err, "couldn't clock in") };
  }
}

export async function clockOutAction(
  args: { reason?: string } = {},
): Promise<DutyActionResult> {
  try {
    await clockOut({ reason: args.reason });
    revalidatePath("/flight-crew");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err, "couldn't clock out") };
  }
}

export interface MorningActionResult {
  ok: boolean;
  error?: string;
}

/** #93: take an aircraft for the day, after duty in. */
export async function pickAircraftAction(aircraftId: string): Promise<MorningActionResult> {
  try {
    await pickMorningAircraft(aircraftId);
    revalidatePath("/flight-crew");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: serviceMessage(err) ?? mapError(err, "Couldn't take the aircraft.") };
  }
}

/** #93: the aircraft's preflight and run-up on record. */
export async function recordPreflightAction(
  id: string,
  body: { fuel_gallons: number | null; oil_quarts: number | null; notes: string | null },
): Promise<MorningActionResult> {
  try {
    await recordMorningPreflight(id, body);
    revalidatePath("/flight-crew");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: serviceMessage(err) ?? mapError(err, "Couldn't record the preflight.") };
  }
}

/** The service's own sentence for a refusal ({detail: {message}}). */
function serviceMessage(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  try {
    const message = JSON.parse(err.message)?.detail?.message;
    return typeof message === "string" ? message : null;
  } catch {
    return null;
  }
}

function mapError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 409) {
      const detail = parseDetail(err.message);
      if (detail === "already_clocked_in") {
        return "You're already clocked in.";
      }
      if (detail === "not_clocked_in") {
        return "You're not currently clocked in.";
      }
    }
    if (err.status === 401) return "Your session expired — sign in again.";
  }
  return fallback;
}

function parseDetail(message: string): string | null {
  try {
    const parsed = JSON.parse(message);
    return typeof parsed.detail === "string" ? parsed.detail : null;
  } catch {
    return null;
  }
}
