/**
 * A lesson draft, done or not (the bug doc's Section 6): the studio asks
 * every few seconds while it runs. A route rather than a server action, as
 * media progress is: polling mustn't hold up a click.
 */

import { ApiError } from "@/lib/api/client";
import { getLessonDraft } from "@/lib/api/lesson-drafts";

export async function GET(_request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(draftId)) return new Response("Not found", { status: 404 });
  try {
    return Response.json(await getLessonDraft(draftId), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 502;
    return new Response(err instanceof ApiError ? err.message : "Unavailable", {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
