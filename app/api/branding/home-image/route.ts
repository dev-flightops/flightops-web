/**
 * The company's uploaded picture for Home (Settings → Branding), for
 * Home's and the branding preview's <img>. An <img> can't attach the
 * bearer token the auth service needs, so this route does it
 * server-side, as the village photos' does.
 */

import { auth } from "@/auth";
import { fetchBackendFile } from "@/lib/api/file-proxy";

export async function GET() {
  const session = await auth();
  if (!session?.access_token) {
    return new Response("Unauthorized", { status: 401 });
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return new Response("API not configured", { status: 500 });
  }
  const response = await fetchBackendFile(`${apiUrl}/auth/settings/company/home-image`, session.access_token);
  if (!response.ok) {
    const message =
      response.status === 404 ? "No picture is uploaded for Home." : `Backend returned ${response.status}`;
    return new Response(message, { status: response.status });
  }
  return new Response(response.body, {
    status: 200,
    headers: {
      // The auth service made it a JPEG; nosniff, as for the photos. Its
      // address carries its upload time (lib/branding/home-image), so the
      // browser may hold it a day: a new picture is a new address.
      "Content-Type": "image/jpeg",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
