/**
 * Public API key management — wraps auth-service /settings/api-keys
 * (flightops-services PR #149).
 *
 *   GET    /auth/settings/api-keys        list (never returns key material)
 *   POST   /auth/settings/api-keys        issue — plaintext returned ONCE
 *   DELETE /auth/settings/api-keys/{id}   revoke (soft; row is kept for audit)
 *
 * Exec-admin only, enforced server-side.
 *
 * Only a SHA-256 hash of each key is stored, so the plaintext exists
 * exactly once — in the create response. There is no "show key again"
 * endpoint and there cannot be one; the UI has to surface it at that
 * moment or it is gone.
 */

import { apiFetch } from "./client";

export interface ApiKeyRow {
  id: string;
  name: string;
  /** Non-secret leading segment, e.g. "pfo_live_kJ8xQ2". Safe to display. */
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
}

export interface ApiKeyListResponse {
  items: ApiKeyRow[];
}

export interface ApiKeyCreateResponse {
  key: ApiKeyRow;
  /** The full key. Shown once, never retrievable again. */
  plaintext: string;
}

export async function listApiKeys(): Promise<ApiKeyListResponse> {
  return apiFetch<ApiKeyListResponse>("/auth/settings/api-keys");
}

export async function createApiKey(input: {
  name: string;
  expires_at?: string | null;
}): Promise<ApiKeyCreateResponse> {
  return apiFetch<ApiKeyCreateResponse>("/auth/settings/api-keys", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await apiFetch<void>(`/auth/settings/api-keys/${keyId}`, {
    method: "DELETE",
  });
}
