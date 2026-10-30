"use server";

import { ApiError } from "@/lib/api/client";
import { acknowledgeForRelease, withdrawReleaseAcknowledgment } from "@/lib/api/ops";
import type { AckKind } from "@/lib/api/types";

export type AckChange = {
  kind: AckKind;
  key: string;
  on: boolean;
  /** What was on screen: a warning's name and message. */
  detail?: Record<string, unknown> | null;
};

export type AckResult = { ok: true } | { ok: false; error: string };

/** Save the dispatcher's ticks on the packet (#155): each one by them,
 *  with its time, where the release reads it. They used to live in the
 *  page's link, so a pre-filled link released with every box ticked. */
export async function saveAcknowledgmentsAction(
  flightId: string,
  changes: AckChange[],
): Promise<AckResult> {
  try {
    await Promise.all(
      changes.map((c) =>
        c.on
          ? acknowledgeForRelease(flightId, c.kind, c.key, c.detail ?? null)
          : withdrawReleaseAcknowledgment(flightId, c.kind, c.key),
      ),
    );
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) return { ok: false, error: "Your session expired — sign in again." };
      if (err.status === 403) return { ok: false, error: "Only a dispatcher acknowledges for release." };
      if (err.status === 409) return { ok: false, error: "The flight is released: nothing more to acknowledge." };
      return { ok: false, error: `That wasn't saved (HTTP ${err.status}). Tick it again.` };
    }
    return { ok: false, error: "Could not reach the ops service. Tick it again in a moment." };
  }
  return { ok: true };
}
