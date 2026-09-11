"use server";

import { askMxIntelligence, type MxAnswer } from "@/lib/api/ai";
import { ApiError } from "@/lib/api/client";

export interface MxResult {
  ok: boolean;
  reply?: MxAnswer;
  error?: string;
}

/**
 * The chat is a client component — it owns the transcript — so the
 * question goes back through here rather than straight at the gateway.
 * apiFetch is server-only: it reads the access token off the session,
 * and a browser fetch has no way to attach it.
 * `lib/api/client-boundary.test.ts` fails the build for importing it
 * from a client component.
 */
export async function askMxAction(
  prompt: string,
  tailNumber: string | null,
): Promise<MxResult> {
  const trimmed = prompt.trim();
  if (!trimmed) return { ok: false, error: "Ask a question first." };
  // Matches the service's own ceiling, so a long question is refused
  // here with a sentence rather than there with a 422.
  if (trimmed.length > 4000) {
    return {
      ok: false,
      error: "That question is too long — try a shorter one.",
    };
  }

  const tail = tailNumber?.trim() || null;

  try {
    return { ok: true, reply: await askMxIntelligence(trimmed, tail) };
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    if (status === 401) {
      return { ok: false, error: "Your session expired — please sign in again." };
    }
    if (status === 403) {
      return {
        ok: false,
        error:
          "MX Intelligence is limited to maintenance, the DOM and the director of operations.",
      };
    }
    if (status === 503) {
      // The service answers 503 when no Anthropic key is configured.
      // Worth saying plainly: it is a deployment gap, not a fault the
      // mechanic can retry away.
      return {
        ok: false,
        error:
          "The AI service has no API key configured, so it cannot answer. This needs an administrator.",
      };
    }
    return {
      ok: false,
      error: "MX Intelligence is unavailable right now. Try again in a moment.",
    };
  }
}
