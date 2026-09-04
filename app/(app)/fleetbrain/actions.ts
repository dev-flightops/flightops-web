"use server";

import { askFleetBrain, type FleetBrainReply } from "@/lib/api/ai";
import { ApiError } from "@/lib/api/client";

export interface AskResult {
  ok: boolean;
  reply?: FleetBrainReply;
  error?: string;
}

/**
 * The chat is a client component — it owns the transcript — so the
 * query goes back through here rather than straight at the gateway.
 * apiFetch is server-only: it reads the access token off the session,
 * and a browser fetch would have no way to attach it.
 *
 * The browser's own timezone rides along. Relative dates ("today",
 * "this week") resolve against it server-side, because the alternative
 * is resolving them in whatever zone the container runs in — which is
 * wrong for most of the day for an operator west of Greenwich.
 */
export async function askAction(
  query: string,
  timezone: string,
): Promise<AskResult> {
  const trimmed = query.trim();
  if (!trimmed) return { ok: false, error: "Ask a question first." };
  if (trimmed.length > 500) {
    return { ok: false, error: "That question is too long — try a shorter one." };
  }

  try {
    return { ok: true, reply: await askFleetBrain(trimmed, timezone) };
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    if (status === 401) {
      return { ok: false, error: "Your session expired — please sign in again." };
    }
    if (status === 403) {
      return { ok: false, error: "You do not have access to FleetBrain." };
    }
    return {
      ok: false,
      error: "FleetBrain is unavailable right now. Try again in a moment.",
    };
  }
}
