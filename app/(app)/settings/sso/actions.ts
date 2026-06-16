"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { deleteSsoProvider, upsertSsoProvider } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type {
  SsoProviderId,
  TenantSsoProviderUpsertRequest,
} from "@/lib/api/types";

/**
 * /settings/sso server actions — upsert (PUT) and delete a per-tenant
 * SSO provider configuration. Validates with zod, hits auth-service
 * `/settings/sso/providers/{id}`, revalidates the page on success.
 *
 * The client_secret rule from the backend is preserved at the action
 * boundary: callers either pass `"keep"` (we omit from the request),
 * `""` (clear) or a non-empty value (overwrite). The dialog encodes
 * "keep" by NOT submitting the field — see configure-provider-dialog.
 */

const SSO_PROVIDER_IDS = [
  "google",
  "microsoft-entra-id",
  "okta",
] as const;

const optionalString = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => v.trim())
    .optional();

const UpsertSchema = z.object({
  provider_id: z.enum(SSO_PROVIDER_IDS),
  display_name: optionalString(100),
  client_id: optionalString(500),
  // Empty string is significant (clear secret). undefined means "keep".
  client_secret: z.string().max(2048).optional(),
  // Provider-specific extras — currently Microsoft Entra tenant_id and
  // Okta domain. Stash both regardless; backend tolerates extras.
  microsoft_tenant_id: optionalString(100),
  okta_domain: optionalString(200),
  is_active: z
    .union([z.literal("on"), z.literal(""), z.undefined()])
    .transform((v) => v === "on"),
});

const DeleteSchema = z.object({
  provider_id: z.enum(SSO_PROVIDER_IDS),
});

export type SsoActionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

function _formatErrors(parsed: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of parsed.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

function _apiError(err: unknown, verb: string): SsoActionState {
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
        message: "Only an Executive Admin can manage SSO providers.",
      };
    }
    if (err.status === 404) {
      return {
        status: "api-error",
        message:
          verb === "save"
            ? "Unknown provider — refresh and try again."
            : "Already disconnected.",
      };
    }
    return {
      status: "api-error",
      message: `Couldn't ${verb} (HTTP ${err.status}). Try again.`,
    };
  }
  return { status: "api-error", message: `Couldn't ${verb}. Try again.` };
}

export async function upsertSsoProviderAction(
  _prev: SsoActionState,
  formData: FormData,
): Promise<SsoActionState> {
  // Pull raw values; we treat a missing `client_secret` form key as
  // "keep existing" so the dialog doesn't need to round-trip an
  // already-set secret just to edit display_name.
  const raw = Object.fromEntries(formData.entries());
  const parsed = UpsertSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "field-errors", errors: _formatErrors(parsed.error) };
  }

  // Build the request body matching the backend's secret rule:
  //   - field absent in formData → omit from body (keep existing)
  //   - field present (incl. empty string) → forward verbatim
  const body: TenantSsoProviderUpsertRequest = {
    display_name: parsed.data.display_name || null,
    client_id: parsed.data.client_id || null,
    is_active: parsed.data.is_active,
  };
  if (formData.has("client_secret")) {
    // Empty string sent on purpose → clear; non-empty → overwrite.
    body.client_secret = parsed.data.client_secret ?? "";
  }

  // Provider-specific extras. Only forward keys the operator filled in.
  const extra: Record<string, string> = {};
  if (parsed.data.microsoft_tenant_id) {
    extra.tenant_id = parsed.data.microsoft_tenant_id;
  }
  if (parsed.data.okta_domain) {
    extra.domain = parsed.data.okta_domain;
  }
  if (Object.keys(extra).length > 0) {
    body.extra_config = extra;
  } else if (
    formData.has("microsoft_tenant_id") || formData.has("okta_domain")
  ) {
    // Form was submitted with the field blanked — explicitly clear it.
    body.extra_config = null;
  }

  try {
    await upsertSsoProvider(
      parsed.data.provider_id as SsoProviderId,
      body,
    );
  } catch (err) {
    return _apiError(err, "save");
  }
  revalidatePath("/settings/sso");
  revalidatePath("/settings");
  return { status: "ok" };
}

export async function deleteSsoProviderAction(
  _prev: SsoActionState,
  formData: FormData,
): Promise<SsoActionState> {
  const parsed = DeleteSchema.safeParse({
    provider_id: formData.get("provider_id"),
  });
  if (!parsed.success) {
    return { status: "api-error", message: "Invalid provider." };
  }
  try {
    await deleteSsoProvider(parsed.data.provider_id as SsoProviderId);
  } catch (err) {
    return _apiError(err, "disconnect");
  }
  revalidatePath("/settings/sso");
  revalidatePath("/settings");
  return { status: "ok" };
}
