/**
 * One village report photo (#121), for the board's and the packet's
 * <img> and the open-in-a-tab link. An <img> can't attach the bearer token
 * the weather service needs, so this route does it server-side, as the
 * ramp photos' does.
 */

import { auth } from "@/auth";
import { fetchBackendFile } from "@/lib/api/file-proxy";

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
    `${apiUrl}/weather/village-photos/${encodeURIComponent(photoId)}`,
    session.access_token,
  );
  if (!response.ok) {
    const message =
      response.status === 404 ? "That photo is no longer on file." : `Backend returned ${response.status}`;
    return new Response(message, { status: response.status });
  }
  return new Response(response.body, {
    status: 200,
    headers: {
      // The weather service made it a JPEG; nosniff, as for ramp photos.
      // A kept photo never changes, so the browser may hold it a day
      // rather than fetch it again on every board and packet refresh.
      "Content-Type": "image/jpeg",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
