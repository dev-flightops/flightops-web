/**
 * Auth-proxying route handler: streams the current version of a
 * document from the documents-service using the session's access token.
 * <a href> can't attach a Bearer header, so this Next.js route does it
 * on the server. Mirrors the /api/dispatch/{id}/release.pdf pattern.
 */

import { auth } from "@/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const session = await auth();
  if (!session?.access_token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { documentId } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return new Response("API not configured", { status: 500 });
  }

  const response = await fetch(
    `${apiUrl}/documents/${documentId}/download`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return new Response(`Backend returned ${response.status}`, {
      status: response.status,
    });
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition":
        response.headers.get("content-disposition") ??
        `attachment; filename="document-${documentId}"`,
      "Cache-Control": "no-store",
    },
  });
}
