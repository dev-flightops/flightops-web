/**
 * Auth-proxying route handler: streams one employee document from the
 * documents-service using the session's access token. `<a href>` can't
 * attach a Bearer header, so this does it server-side. Mirrors
 * /api/documents/{id}/download.
 *
 * The backend decides who may read the file — exec admin, or the
 * employee it belongs to. This does not second-guess that; it forwards
 * the status, so a 403 stays a 403 rather than becoming a broken
 * download.
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
    `${apiUrl}/employee-documents/${documentId}/download`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    // A personnel file is not a place to be vague about refusals, but
    // it is also not a place to echo the backend's body — these are
    // read by a browser, not a form.
    const message =
      response.status === 403
        ? "You do not have access to that document."
        : response.status === 404
          ? "That document is no longer on file."
          : `Backend returned ${response.status}`;
    return new Response(message, { status: response.status });
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition":
        response.headers.get("content-disposition") ??
        `attachment; filename="employee-document-${documentId}"`,
      // Personnel documents should not sit in a shared cache.
      "Cache-Control": "no-store, private",
    },
  });
}
