"use server";

import { askAiQuery, type AiQueryResult } from "@/lib/api/ai";
import { ApiError } from "@/lib/api/client";

export interface AskResult {
  ok: boolean;
  result?: AiQueryResult;
  error?: string;
}

/**
 * The page owns the transcript, so the question goes back through
 * here: apiFetch is server-only and reads the access token off the
 * session, which a browser fetch has no way to attach.
 *
 * The browser's timezone rides along — the service resolves "last
 * month" against it rather than against whatever zone the container
 * runs in.
 */
export async function askQueryAction(
  question: string,
  timezone: string,
): Promise<AskResult> {
  const trimmed = question.trim();
  if (!trimmed) return { ok: false, error: "Ask a question first." };
  if (trimmed.length > 500) {
    return { ok: false, error: "That question is too long — try a shorter one." };
  }

  try {
    return { ok: true, result: await askAiQuery(trimmed, timezone) };
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    if (status === 401) {
      return { ok: false, error: "Your session expired — please sign in again." };
    }
    if (status === 403) {
      return { ok: false, error: "You do not have access to Intelligence Query." };
    }
    if (status === 503) {
      // The service is up; the model is not configured for this
      // deployment. Different from broken, and worth saying so.
      return {
        ok: false,
        error: "AI features are not configured for this deployment.",
      };
    }
    return {
      ok: false,
      error: "That question could not be answered right now. Try again.",
    };
  }
}
