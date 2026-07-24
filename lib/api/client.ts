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

// Next.js-flavoured RequestInit shape carries a `next` field with the
// caching extensions (`tags`, `revalidate`). Allow callers to opt
// into tag-based caching for the few endpoints where the data
// propagates via revalidateTag (Spec 6 stations is the M2 case).
type NextFetchInit = RequestInit & {
  next?: { tags?: string[]; revalidate?: number | false };
};

export async function apiFetch<T>(
  path: string,
  init: NextFetchInit = {},
): Promise<T> {
  const session = await auth();
  if (!session?.access_token) {
    throw new SessionExpiredError(path, "no session");
  }

  // If the caller opted into tag-based caching (`next: { tags: [...] }`),
  // skip the default `cache: "no-store"` so Next's data cache actually
  // populates and `revalidateTag()` has something to invalidate.
  // Operational endpoints (dispatch, flights, duty, etc.) don't pass
  // tags, so they keep the no-store behaviour they had before.
  const hasTags =
    Array.isArray(init.next?.tags) && init.next!.tags!.length > 0;
  const cache: RequestCache | undefined =
    init.cache ?? (hasTags ? undefined : "no-store");

  const url = `${apiBaseUrl()}${path}`;
  // FormData bodies must NOT carry an explicit Content-Type — the
  // browser (or undici under Node) sets one with the multipart
  // boundary. Setting application/json breaks the upload.
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  const baseHeaders: Record<string, string> = isFormData
    ? {}
    : { "Content-Type": "application/json" };
  const response = await fetch(url, {
    ...init,
    headers: {
      ...baseHeaders,
      ...init.headers,
      Authorization: `Bearer ${session.access_token}`,
    },
    cache,
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

  // 204 No Content (e.g. DELETE soft-delete endpoints) — no body to parse.
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
