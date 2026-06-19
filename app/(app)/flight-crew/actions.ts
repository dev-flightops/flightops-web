"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { clockIn, clockOut } from "@/lib/api/ops";

export interface DutyActionResult {
  ok: boolean;
  /** Short message the duty button shows inline on failure. */
  error?: string;
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
    await clockIn({ rest_acknowledged: args.rest_acknowledged });
    revalidatePath("/flight-crew");
    return { ok: true };
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
