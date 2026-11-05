/**
 * A lesson's uploaded picture, video or PDF (#170), as the signed-in user.
 * A <video> or <img> can't attach a Bearer header, so this does it on the
 * server. In a bucket the browser is sent there; locally the bytes come
 * through here, and a video's Range requests go with them, so it can seek.
 */

import { auth } from "@/auth";
import { fetchBackendFile, storageRedirect } from "@/lib/api/file-proxy";

const PASSED_ON = ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  const session = await auth();
  if (!session?.access_token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { mediaId } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return new Response("API not configured", { status: 500 });
  }

  const range = request.headers.get("range");
  const response = await fetchBackendFile(
    `${apiUrl}/academy/lesson-media/${mediaId}/file`,
    session.access_token,
    range ? { Range: range } : {},
  );

  const redirect = storageRedirect(response);
  if (redirect) return redirect;
  if (!response.ok) {
    return new Response(`Backend returned ${response.status}`, {
      status: response.status,
    });
  }

  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of PASSED_ON) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
}
