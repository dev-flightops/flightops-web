/**
 * A ForeFlight plan's navlog, briefing or W&B report (#55). ForeFlight's
 * links expire, so each click asks ops for a fresh one and goes there.
 * A browser <a href> can't attach the Bearer header, hence the route.
 */

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { getPlanDocument, type PlanDocument } from "@/lib/api/integrations";

const KINDS: ReadonlySet<string> = new Set<PlanDocument>(["navlog", "briefing", "wb"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REFUSALS: Record<string, string> = {
  foreflight_not_connected:
    "ForeFlight isn't connected any more, so its documents can't be opened from here.",
  foreflight_key_rejected:
    "ForeFlight turned the company's key away. The Director of Operations can replace it under Settings → ForeFlight.",
  document_unavailable: "ForeFlight has no such document for this flight yet.",
  plan_not_found: "That plan is gone. Refresh the dispatch page.",
};

function text(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string; kind: string }> },
) {
  const session = await auth();
  if (!session?.access_token) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { planId, kind } = await params;
  if (!UUID.test(planId) || !KINDS.has(kind)) {
    return text("Not found", 404);
  }
  try {
    const { url } = await getPlanDocument(planId, kind as PlanDocument);
    if (!url?.startsWith("https://")) {
      return text("ForeFlight gave no usable link for this document.", 502);
    }
    return new Response(null, {
      status: 302,
      headers: { Location: url, "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) return text("Your session expired. Sign in again.", 401);
      const code = Object.keys(REFUSALS).find((c) => err.message.includes(c));
      if (code) return text(REFUSALS[code], err.status === 404 ? 404 : 409);
    }
    return text("ForeFlight couldn't be reached. Try again in a moment.", 502);
  }
}
