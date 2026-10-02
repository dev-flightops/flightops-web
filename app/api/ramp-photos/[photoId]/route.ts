/**
 * One ramp photo, for the gallery's <img> and its open-in-a-tab link.
 * An <img> can't attach the bearer token the ground service needs, so
 * this route does it server-side, like the document downloads.
 *
 * Until 1 Oct the gallery pointed at /uploads/ramp_photos/<key>, a path
 * nothing served, so every thumbnail was a broken image.
 *
 * nosniff: the bytes are served from this app's own origin when they
 * stream through (local storage), so the browser must take the ground
 * service's type as given and never guess its way to HTML.
 */

import { auth } from "@/auth";
import { fetchBackendFile, storageRedirect } from "@/lib/api/file-proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const session = await auth();
  if (!session?.access_token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { photoId } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return new Response("API not configured", { status: 500 });
  }

  const response = await fetchBackendFile(
    `${apiUrl}/ground/photos/${encodeURIComponent(photoId)}/file`,
    session.access_token,
  );

  const redirect = storageRedirect(response);
  if (redirect) return redirect;
  if (!response.ok) {
    const message =
      response.status === 404 ? "That photo is no longer on file." : `Backend returned ${response.status}`;
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
