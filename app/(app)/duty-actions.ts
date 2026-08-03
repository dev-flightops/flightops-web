"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { clockIn, clockOut } from "@/lib/api/ops";

export interface DutyActionResult {
  ok: boolean;
  /** Short message the calling button surfaces inline on failure. */
  error?: string;
}

/**
 * Shared duty clock-in / clock-out server actions used by both the
 * hero button on /flight-crew and the pill in the top-bar header.
 * Revalidates the layout so the header pill's initial state (fetched
 * in the (app) layout) refreshes on the next paint from anywhere.
 */

export async function clockInAction(
  args: { rest_acknowledged?: boolean } = {},
): Promise<DutyActionResult> {
  try {
    await clockIn({ rest_acknowledged: args.rest_acknowledged });
    revalidatePath("/", "layout");
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
    revalidatePath("/", "layout");
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
