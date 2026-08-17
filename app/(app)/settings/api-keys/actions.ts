"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { createApiKey, revokeApiKey } from "@/lib/api/api-keys";

/** /settings/api-keys server actions. Follows the /settings/fleet
 *  action shape: a discriminated result the client renders inline
 *  rather than throwing. */

export type ApiKeyActionState =
  | { status: "idle" }
  | { status: "created"; plaintext: string; name: string }
  | { status: "revoked" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

function _apiError(err: unknown, verb: string): ApiKeyActionState {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return {
        status: "api-error",
        message: "Your session expired — please sign in again.",
      };
    }
    if (err.status === 403) {
      return {
        status: "api-error",
        message: "Only an Exec Admin can manage API keys.",
      };
    }
    return {
      status: "api-error",
      message: `Couldn't ${verb} (HTTP ${err.status}). Try again in a moment.`,
    };
  }
  return { status: "api-error", message: `Couldn't ${verb}. Please try again.` };
}

export async function issueApiKeyAction(
  _prev: ApiKeyActionState,
  formData: FormData,
): Promise<ApiKeyActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return {
      status: "field-errors",
      errors: { name: "Give the key a name so you can tell it apart later." },
    };
  }
  if (name.length > 120) {
    return {
      status: "field-errors",
      errors: { name: "Keep the name under 120 characters." },
    };
  }

  // Optional expiry. A blank field means "no natural expiry" — the key
  // then only stops when someone revokes it, which is a deliberate
  // choice the operator makes, not a default we impose.
  const rawExpiry = String(formData.get("expires_at") ?? "").trim();
  let expires_at: string | null = null;
  if (rawExpiry) {
    const when = new Date(rawExpiry);
    if (Number.isNaN(when.getTime())) {
      return {
        status: "field-errors",
        errors: { expires_at: "That isn't a valid date." },
      };
    }
    if (when.getTime() <= Date.now()) {
      return {
        status: "field-errors",
        errors: { expires_at: "Expiry must be in the future." },
      };
    }
    expires_at = when.toISOString();
  }

  try {
    const created = await createApiKey({ name, expires_at });
    revalidatePath("/settings/api-keys");
    // The plaintext is carried back to the client because this is the
    // only moment it exists — only a hash is stored server-side.
    return {
      status: "created",
      plaintext: created.plaintext,
      name: created.key.name,
    };
  } catch (err) {
    return _apiError(err, "create the key");
  }
}

export async function revokeApiKeyAction(
  _prev: ApiKeyActionState,
  formData: FormData,
): Promise<ApiKeyActionState> {
  const keyId = String(formData.get("key_id") ?? "");
  if (!keyId) {
    return { status: "api-error", message: "Missing key id." };
  }
  try {
    await revokeApiKey(keyId);
    revalidatePath("/settings/api-keys");
    return { status: "revoked" };
  } catch (err) {
    return _apiError(err, "revoke the key");
  }
}
