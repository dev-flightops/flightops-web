/**
 * Server-side API client. Pulls the access_token from the current session
 * (set by Auth.js via /auth/login → JWT cookie) and attaches it as a Bearer
 * header. Throws ApiError on non-2xx so callers can map to notFound() etc.
 *
 * Only safe to call from server components or server actions. For client
 * components, route requests through a server action that calls these.
 */

import { auth } from "@/auth";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Thrown when the backend rejects the access_token (401), or when there is
 * no session at all. Error boundaries should prompt re-login instead of
 * showing a generic error page.
 */
export class SessionExpiredError extends ApiError {
  constructor(path: string, message: string) {
    super(401, path, message);
    this.name = "SessionExpiredError";
  }
}

const apiBaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_URL not configured");
  }
  return url;
};

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const session = await auth();
  if (!session?.access_token) {
    throw new SessionExpiredError(path, "no session");
  }

  const url = `${apiBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
      Authorization: `Bearer ${session.access_token}`,
    },
    cache: "no-store", // dispatch data is operational — never cache
  });

  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      /* ignore */
    }
    // Any 401 here means the user's session is no longer valid (expired,
    // revoked, or malformed token). Trigger the session-expired flow.
    if (response.status === 401) {
      throw new SessionExpiredError(path, body || "session expired");
    }
    throw new ApiError(response.status, path, body || response.statusText);
  }

  return (await response.json()) as T;
}
