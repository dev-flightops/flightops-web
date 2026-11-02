/**
 * One file kept with a ground equipment unit (#134), for its Download link.
 * A link can't attach the bearer token the ground service needs, so this
 * route does it server-side, as the ramp photos and documents do.
 *
 * Always a download: the ground service reads the type from the bytes and
 * serves it as an attachment, and nosniff keeps the browser from guessing
 * its way to HTML when the bytes stream through this origin.
 */

import { auth } from "@/auth";
import { fetchBackendFile, storageRedirect } from "@/lib/api/file-proxy";

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await auth();
  if (!session?.access_token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { documentId } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return new Response("API not configured", { status: 500 });
  }

  const response = await fetchBackendFile(
    `${apiUrl}/ground/gse/documents/${encodeURIComponent(documentId)}/file`,
    session.access_token,
  );

  const redirect = storageRedirect(response);
  if (redirect) return redirect;
  if (!response.ok) {
    const message =
      response.status === 404 ? "That document is no longer on file." : `Backend returned ${response.status}`;
    return new Response(message, { status: response.status });
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": response.headers.get("content-disposition") ?? "attachment",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
