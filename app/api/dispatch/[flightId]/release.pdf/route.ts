/**
 * Auth-proxying route handler: streams the backend PDF to the browser using
 * the current session's access_token. Browser <a href> can't attach a Bearer
 * header, so this Next.js route does it on the server.
 */

import { auth } from "@/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ flightId: string }> },
) {
  const session = await auth();
  if (!session?.access_token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { flightId } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return new Response("API not configured", { status: 500 });
  }

  const response = await fetch(`${apiUrl}/ops/flights/${flightId}/release.pdf`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return new Response(`Backend returned ${response.status}`, {
      status: response.status,
    });
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        response.headers.get("content-disposition") ??
        `inline; filename="flight-${flightId}-release.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
