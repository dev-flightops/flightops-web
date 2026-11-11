/**
 * Auth-proxying route handler: streams one document kept with a drug or
 * alcohol test from the documents service using the session's access
 * token, as /api/employee-documents/{id}/download does.
 *
 * The service decides who may read it: whoever runs the program, or the
 * person tested. A refusal is passed on as a refusal.
 */

import { auth } from "@/auth";
import { fetchBackendFile, storageRedirect } from "@/lib/api/file-proxy";

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await auth();
  if (!session?.access_token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { fileId } = await params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return new Response("API not configured", { status: 500 });
  }

  const response = await fetchBackendFile(`${apiUrl}/drug-alcohol/files/${fileId}/download`, session.access_token);

  const redirect = storageRedirect(response);
  if (redirect) return redirect;
  if (!response.ok) {
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
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition":
        response.headers.get("content-disposition") ?? `attachment; filename="drug-alcohol-document-${fileId}"`,
      // Test documents are confidential: never in a shared cache.
      "Cache-Control": "no-store, private",
    },
  });
}
