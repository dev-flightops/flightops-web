/**
 * A safety report's photo or PDF (#58), for the report page's <img> and
 * its open-in-a-tab link. An <img> can't attach the bearer token the
 * safety service needs, so this route does it server-side, like the
 * ramp photos. The service decides who may read it: the safety team, or
 * whoever filed the report.
 *
 * nosniff: when the bytes stream through (local storage) they come from
 * this app's own origin, so the browser must take the service's type as
 * given and never guess its way to HTML.
 */

import { auth } from "@/auth";
import { fetchBackendFile, storageRedirect } from "@/lib/api/file-proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.access_token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return new Response("API not configured", { status: 500 });
  }

  const response = await fetchBackendFile(
    `${apiUrl}/safety/reports/${encodeURIComponent(id)}/attachment`,
    session.access_token,
  );

  const redirect = storageRedirect(response);
  if (redirect) return redirect;
  if (!response.ok) {
    const message =
      response.status === 404 ? "That attachment is no longer on file." : `Backend returned ${response.status}`;
    return new Response(message, { status: response.status });
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": response.headers.get("content-disposition") ?? "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
