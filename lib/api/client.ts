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
    throw new ApiError(401, path, "no session — caller must be authenticated");
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
    throw new ApiError(response.status, path, body || response.statusText);
  }

  return (await response.json()) as T;
}
