import { createHash } from "node:crypto";

import { auth } from "@/auth";
import { helpCorpus } from "@/lib/help/corpus";

/**
 * The help assistant (#114): the browser's question to ai's
 * /ai/help/ask, and its answer streamed back as it is written.
 *
 * Server-side so the session's token never reaches the page, as on every
 * other proxy here. The help content goes with the question by its hash;
 * the text itself is sent only when the ai service answers 409
 * `help_corpus_needed` (it doesn't hold that version yet, after a deploy
 * or a restart), and then the question is asked again with it. Over the
 * demo's tunnel the text costs a couple of seconds; the hash nothing.
 *
 * The hash is of the same bytes the ai service hashes (UTF-8), and it
 * checks it: content that doesn't match the hash it is sent under is
 * refused there.
 */

// An answer streams for a few seconds; a slow one, with a re-sent
// question, stays well inside this.
export const maxDuration = 60;

const CORPUS = helpCorpus();
const CORPUS_VERSION = createHash("sha256").update(CORPUS, "utf8").digest("hex");

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.access_token) {
    return Response.json({ error: "session_expired" }, { status: 401 });
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return Response.json({ error: "api_not_configured" }, { status: 500 });
  }

  let messages: unknown;
  try {
    ({ messages } = (await request.json()) as { messages?: unknown });
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!Array.isArray(messages)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const ask = (withCorpus: boolean) =>
    fetch(`${apiUrl}/ai/help/ask`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        corpus_version: CORPUS_VERSION,
        messages,
        ...(withCorpus && { corpus: CORPUS }),
      }),
      cache: "no-store",
    });

  let upstream = await ask(false);
  if (upstream.status === 409) {
    const body = (await upstream.json().catch(() => null)) as { detail?: string } | null;
    if (body?.detail === "help_corpus_needed") upstream = await ask(true);
  }

  if (!upstream.ok || !upstream.body) {
    const body = (await upstream.json().catch(() => null)) as { detail?: unknown } | null;
    const code = typeof body?.detail === "string" ? body.detail : "help_unavailable";
    const retryAfter = upstream.headers.get("retry-after");
    return Response.json(
      { error: code },
      {
        status: upstream.status === 200 ? 502 : upstream.status,
        headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
      },
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
