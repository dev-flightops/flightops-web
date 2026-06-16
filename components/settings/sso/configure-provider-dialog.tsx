"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type {
  ProviderCatalogEntry,
  TenantSsoProviderResponse,
} from "@/lib/api/types";

import {
  upsertSsoProviderAction,
  type SsoActionState,
} from "@/app/(app)/settings/sso/actions";

/**
 * Connect / Edit dialog for one SSO provider. Doubles as both flows
 * because the underlying PUT endpoint is idempotent — same form, same
 * action, the only difference is whether `existing` is pre-populated.
 *
 * Secret rule (mirrors backend M2-M-28c):
 *   - When `has_secret` is already true, the field renders empty with
 *     a placeholder telling the admin not to retype unless changing.
 *     The form drops the `client_secret` key from the submission when
 *     the user leaves it blank, so the server "keep existing" path
 *     fires.
 *   - When `has_secret` is false (new connect), the field is required.
 *   - To explicitly *clear* a stored secret, click "Clear secret"
 *     which marks a hidden `client_secret_clear` input → the form
 *     submits `client_secret=""` (the server's "clear" sentinel).
 */
export function ConfigureProviderDialog({
  catalog,
  existing,
  ctaLabel,
  ctaVariant = "primary",
}: {
  catalog: ProviderCatalogEntry;
  existing: TenantSsoProviderResponse | null;
  ctaLabel: string;
  ctaVariant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [clearSecret, setClearSecret] = useState(false);
  const [state, action, pending] = useActionState<SsoActionState, FormData>(
    upsertSsoProviderAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "ok") {
      setOpen(false);
      setClearSecret(false);
    }
  }, [state.status]);

  // Reset the "clear secret" intent whenever the dialog re-opens.
  useEffect(() => {
    if (!open) setClearSecret(false);
  }, [open]);

  const fieldError = (key: string) =>
    state.status === "field-errors" ? state.errors[key] : undefined;

  const initialExtra = useMemo(() => {
    const e = existing?.extra_config ?? {};
    return {
      microsoft_tenant_id:
        typeof e.tenant_id === "string" ? e.tenant_id : "",
      okta_domain: typeof e.domain === "string" ? e.domain : "",
    };
  }, [existing]);

  const buttonClass =
    ctaVariant === "primary"
      ? "inline-flex items-center gap-1.5 rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
      : "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
        {ctaLabel}
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {existing ? "Edit" : "Connect"} {catalog.label}
            </DialogTitle>
            <DialogDescription>
              {existing
                ? "Update credentials or the display name. Leaving the client secret blank keeps the existing value — click Clear secret to disconnect without deleting the row."
                : "Paste the OAuth client_id and client_secret from your IdP console. Both are required to enable the sign-in button for your tenant."}
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <input
              type="hidden"
              name="provider_id"
              value={catalog.id}
            />

            {state.status === "api-error" && (
              <div
                role="alert"
                className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
              >
                {state.message}
              </div>
            )}

            <Field
              name="display_name"
              label={`Display name (overrides "${catalog.label}")`}
              defaultValue={existing?.display_name ?? ""}
              placeholder={catalog.label}
              error={fieldError("display_name")}
            />

            <Field
              name="client_id"
              label="OAuth Client ID"
              defaultValue={existing?.client_id ?? ""}
              required={!existing}
              autoComplete="off"
              error={fieldError("client_id")}
            />

            <SecretField
              hasExistingSecret={!!existing?.has_secret}
              clearSecret={clearSecret}
              onToggleClear={setClearSecret}
              error={fieldError("client_secret")}
            />

            {catalog.id === "microsoft-entra-id" && (
              <Field
                name="microsoft_tenant_id"
                label="Microsoft Entra Tenant ID"
                placeholder="11111111-2222-3333-4444-555555555555"
                defaultValue={initialExtra.microsoft_tenant_id}
                error={fieldError("microsoft_tenant_id")}
              />
            )}
            {catalog.id === "okta" && (
              <Field
                name="okta_domain"
                label="Okta domain"
                placeholder="acme.okta.com"
                defaultValue={initialExtra.okta_domain}
                error={fieldError("okta_domain")}
              />
            )}

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={existing?.is_active ?? true}
                className="h-4 w-4 rounded border-border bg-background text-status-blue focus:ring-status-blue"
              />
              Active (Sign-in button visible to your users)
            </label>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-status-blue px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {pending && <Spinner size="xs" />}
                {pending ? "Saving…" : existing ? "Save" : "Connect"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SecretField({
  hasExistingSecret,
  clearSecret,
  onToggleClear,
  error,
}: {
  hasExistingSecret: boolean;
  clearSecret: boolean;
  onToggleClear: (v: boolean) => void;
  error: string | undefined;
}) {
  // Three modes:
  //   1) No secret stored yet → required text input.
  //   2) Secret stored, "keep" mode → no input rendered at all (so the
  //      form doesn't send a client_secret key, which the server reads
  //      as "keep existing").
  //   3) Secret stored, "clear" mode → hidden empty input named
  //      client_secret submits "" → server clears the stored value.
  const label = "OAuth Client Secret";
  if (!hasExistingSecret) {
    return (
      <div>
        <label
          htmlFor="client_secret"
          className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          {label}
          <span className="text-status-red"> *</span>
        </label>
        <input
          id="client_secret"
          name="client_secret"
          type="password"
          required
          autoComplete="new-password"
          aria-invalid={error ? "true" : undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
        />
        {error && (
          <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label
          htmlFor="client_secret_change"
          className="block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          {label}
        </label>
        <button
          type="button"
          onClick={() => onToggleClear(!clearSecret)}
          className={
            clearSecret
              ? "text-[0.65rem] font-semibold text-status-yellow hover:underline"
              : "text-[0.65rem] font-semibold text-status-red hover:underline"
          }
        >
          {clearSecret ? "Cancel clear" : "Clear secret"}
        </button>
      </div>
      {clearSecret ? (
        <>
          <div
            role="status"
            className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-[0.7rem] text-status-yellow"
          >
            The stored secret will be cleared on save. The provider will
            keep its row but sign-in will fail until a new secret is
            entered.
          </div>
          <input type="hidden" name="client_secret" value="" />
        </>
      ) : (
        <input
          id="client_secret_change"
          name="client_secret"
          type="password"
          placeholder="•••••• (configured — leave blank to keep)"
          autoComplete="new-password"
          aria-invalid={error ? "true" : undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
        />
      )}
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  error,
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
        {inputProps.required && <span className="text-status-red"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
        {...inputProps}
      />
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
