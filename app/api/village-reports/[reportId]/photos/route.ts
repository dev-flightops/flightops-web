/**
 * Send a village report's photo (#121) on to the weather service, which
 * turns it upright, makes it small and keeps it with the report. The
 * browser shrinks a phone photo first (lib/images/downscale), so it stays
 * well under the host's 4.5 MB request cap.
 */

import { auth } from "@/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const session = await auth();
  if (!session?.access_token) {
    return Response.json({ detail: "Your session expired — please sign in again." }, { status: 401 });
  }
  const { reportId } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return Response.json({ detail: "API not configured" }, { status: 500 });
  }
  const incoming = await request.formData();
  const photo = incoming.get("photo");
  if (!(photo instanceof Blob)) {
    return Response.json({ detail: "No photo was sent." }, { status: 422 });
  }
  const outgoing = new FormData();
  outgoing.append("photo", photo, photo instanceof File ? photo.name : "photo.jpg");
  const response = await fetch(
    `${apiUrl}/weather/village-reports/${encodeURIComponent(reportId)}/photos`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: outgoing,
      cache: "no-store",
    },
  );
  const body = await response.json().catch(() => ({}));
  return Response.json(body, { status: response.status });
}
