/**
 * Shared by the route handlers that hand a backend file to the browser
 * (documents, employee documents, ramp photos).
 *
 * In production the services keep files in a bucket and answer a download
 * with a 302 to a link that works for five minutes. The handler passes
 * that redirect on, so the browser fetches the file from the bucket
 * itself: a Vercel function cannot return more than 4.5 MB, and the bytes
 * have no reason to pass through it. Locally the service streams the file
 * and the handler streams it on, as before.
 */

/** Fetch a backend file without following a redirect to storage. */
export function fetchBackendFile(url: string, accessToken: string): Promise<Response> {
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    redirect: "manual",
  });
}

/** The browser-facing redirect when the backend answered with one. */
export function storageRedirect(response: Response): Response | null {
  if (response.status < 300 || response.status > 399) return null;
  const location = response.headers.get("location");
  if (!location) return null;
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "private, no-store" },
  });
}
