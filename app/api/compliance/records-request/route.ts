/**
 * Auth-proxying route handler for the regulatory disclosure bundle.
 *
 * The archive comes back from a POST, because producing one is an act
 * of disclosure that writes a record — a GET that wrote a row would be
 * a GET a browser prefetch could perform. `apiFetch` parses response
 * bodies and cannot carry a zip, so this handler attaches the Bearer
 * token server-side and streams the bytes through, the same shape as
 * the dispatch release PDF.
 *
 * The disclosure id and hash come back as headers and are forwarded,
 * so the page can link to the record it just created without a second
 * round trip.
 */

import { auth } from "@/auth";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.access_token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return new Response("API not configured", { status: 500 });
  }

  const body = await request.text();
  const response = await fetch(`${apiUrl}/reports/disclosure/produce`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    // The backend's refusals are specific and actionable — an unknown
    // tail, a receipt in the future, a scope too large to produce
    // without truncating. Passing the body straight through keeps that
    // message rather than replacing it with a status code.
    return new Response(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = new Headers({
    "Content-Type": "application/zip",
    "Cache-Control": "no-store",
    "Content-Disposition":
      response.headers.get("content-disposition") ??
      'attachment; filename="records.zip"',
  });
  for (const name of ["x-disclosure-id", "x-disclosure-sha256"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  // So the browser can read them off an XHR response.
  headers.set(
    "Access-Control-Expose-Headers",
    "Content-Disposition, X-Disclosure-Id, X-Disclosure-Sha256",
  );

  return new Response(response.body, { status: 200, headers });
}
