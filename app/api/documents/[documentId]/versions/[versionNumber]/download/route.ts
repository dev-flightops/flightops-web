/**
 * Auth-proxying route for a specific version of a document. Same shape
 * as the current-version handler in ../../download/route.ts — separate
 * file because Next.js route params include `versionNumber` here.
 */

import { auth } from "@/auth";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ documentId: string; versionNumber: string }>;
  },
) {
  const session = await auth();
  if (!session?.access_token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { documentId, versionNumber } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return new Response("API not configured", { status: 500 });
  }

  const response = await fetch(
    `${apiUrl}/documents/${documentId}/versions/${versionNumber}/download`,
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
        `attachment; filename="document-${documentId}-v${versionNumber}"`,
      "Cache-Control": "no-store",
    },
  });
}
