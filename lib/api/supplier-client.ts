/**
 * M3-X-2 — server-side API client for the fuel-supplier portal.
 *
 * Parallel to lib/api/client.ts (which reads Auth.js session). This
 * one reads the httpOnly `fuel_supplier_session` cookie set by the
 * supplier login flow.
 *
 * Same error surface (ApiError, SessionExpiredError) so callers can
 * map to the shared error boundaries; the ONLY differences from the
 * main-app client are the token source and the redirect target when
 * the session is missing.
 */

import { ApiError, SessionExpiredError } from "./client";
import { getSupplierSession } from "./supplier-session";

const apiBaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL not configured");
  return url;
};

type NextFetchInit = RequestInit & {
  next?: { tags?: string[]; revalidate?: number | false };
};

export async function supplierApiFetch<T>(
  path: string,
  init: NextFetchInit = {},
): Promise<T> {
  const session = await getSupplierSession();
  if (!session) {
    throw new SessionExpiredError(path, "no_supplier_session");
  }

  const hasTags =
    Array.isArray(init.next?.tags) && init.next!.tags!.length > 0;
  const cache: RequestCache | undefined =
    init.cache ?? (hasTags ? undefined : "no-store");

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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
    if (response.status === 401) {
      throw new SessionExpiredError(path, body || "supplier session expired");
    }
    throw new ApiError(response.status, path, body || response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
