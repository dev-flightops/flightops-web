import Link from "next/link";

import { ConfigureProviderDialog } from "@/components/settings/sso/configure-provider-dialog";
import { DisconnectProviderButton } from "@/components/settings/sso/disconnect-provider-button";
import { getSsoCatalog, listSsoProviders } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type {
  ProviderCatalogEntry,
  TenantSsoProviderResponse,
} from "@/lib/api/types";

/**
 * /settings/sso — SSO & Integrations (M2-G-settings-sso-admin).
 *
 * One card per provider in the backend catalog. For each card:
 *   - Configured + active → "Connected" badge, edit + disconnect.
 *   - Configured + inactive → muted "Configured but off" state.
 *   - Not configured → "Connect" CTA opens the upsert dialog.
 *
 * exec_admin only — anyone else gets the 403 warning banner and the
 * provider cards don't render.
 */
export default async function SettingsSsoPage() {
  let catalog: ProviderCatalogEntry[] = [];
  let configured: TenantSsoProviderResponse[] = [];
  let loadError: string | null = null;
  let unauthorized = false;

  try {
    const [catalogResp, providersResp] = await Promise.all([
      getSsoCatalog(),
      listSsoProviders(),
    ]);
    catalog = catalogResp.providers;
    configured = providersResp.items;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        loadError = "Your session expired — please sign in again.";
      } else if (err.status === 403) {
        unauthorized = true;
      } else {
        loadError = "SSO catalog unavailable. Try refreshing in a moment.";
      }
    } else {
      loadError = "SSO catalog unavailable. Try refreshing in a moment.";
    }
  }

  const byProviderId = new Map(
    configured.map((p) => [p.provider_id, p] as const),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">SSO & Integrations</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          SSO & Integrations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-tenant OAuth credentials for Google / Microsoft / Okta sign-in.
          Each tenant configures its own — credentials never leave this
          tenant.
        </p>
      </header>

      {unauthorized && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          You need the Executive Admin role to manage SSO providers.
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      )}

      {!unauthorized && !loadError && (
        <ul className="space-y-3">
          {catalog.map((entry) => (
            <li key={entry.id}>
              <ProviderCard
                catalog={entry}
                existing={byProviderId.get(entry.id) ?? null}
              />
            </li>
          ))}
        </ul>
      )}

      {!unauthorized && (
        <p className="mt-8 text-xs text-muted-foreground">
          Notes: \`client_secret\` never leaves the server after it&apos;s
          stored. At-rest encryption is a planned follow-up (M3
          hardening). Until the web Auth.js wiring lands in a separate
          story, a connected provider here is admin-visible only —
          users don&apos;t see the sign-in button yet.
        </p>
      )}
    </div>
  );
}

function ProviderCard({
  catalog,
  existing,
}: {
  catalog: ProviderCatalogEntry;
  existing: TenantSsoProviderResponse | null;
}) {
  const status = providerStatus(existing);
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {existing?.display_name || catalog.label}
            </h2>
            <StatusChip status={status} />
            {existing?.display_name && (
              <code className="text-[0.65rem] text-muted-foreground">
                ({catalog.label})
              </code>
            )}
          </div>
          {existing ? (
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[0.75rem] sm:grid-cols-2">
              <Row
                label="Client ID"
                value={existing.client_id ?? "—"}
                mono
              />
              <Row
                label="Client secret"
                value={existing.has_secret ? "✓ stored" : "not set"}
                tone={existing.has_secret ? "green" : "yellow"}
              />
              {catalog.id === "microsoft-entra-id" && (
                <Row
                  label="Entra tenant"
                  value={
                    extraField(existing, "tenant_id") ?? "—"
                  }
                  mono
                />
              )}
              {catalog.id === "okta" && (
                <Row
                  label="Okta domain"
                  value={extraField(existing, "domain") ?? "—"}
                  mono
                />
              )}
            </dl>
          ) : (
            <p className="mt-2 text-[0.75rem] text-muted-foreground">
              Not configured. Click <strong>Connect</strong> to paste
              the client ID + secret from the {catalog.label} console.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {existing ? (
            <>
              <ConfigureProviderDialog
                catalog={catalog}
                existing={existing}
                ctaLabel="Edit"
                ctaVariant="secondary"
              />
              <DisconnectProviderButton
                providerId={existing.provider_id}
                providerLabel={catalog.label}
              />
            </>
          ) : (
            <ConfigureProviderDialog
              catalog={catalog}
              existing={null}
              ctaLabel="Connect"
            />
          )}
        </div>
      </div>
    </article>
  );
}

type ProviderStatus = "connected" | "configured-inactive" | "not-configured";

function providerStatus(
  existing: TenantSsoProviderResponse | null,
): ProviderStatus {
  if (!existing) return "not-configured";
  if (!existing.is_active) return "configured-inactive";
  return "connected";
}

function StatusChip({ status }: { status: ProviderStatus }) {
  const palette: Record<ProviderStatus, string> = {
    connected:
      "border-status-green/40 bg-status-green/10 text-status-green",
    "configured-inactive":
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    "not-configured": "border-border bg-muted/30 text-muted-foreground",
  };
  const label: Record<ProviderStatus, string> = {
    connected: "Connected",
    "configured-inactive": "Inactive",
    "not-configured": "Not configured",
  };
  return (
    <span
      className={`rounded-sm border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${palette[status]}`}
    >
      {label[status]}
    </span>
  );
}

function Row({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "green" | "yellow";
}) {
  const toneClass =
    tone === "green"
      ? "text-status-green"
      : tone === "yellow"
        ? "text-status-yellow"
        : "text-foreground";
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`min-w-0 truncate ${toneClass} ${
          mono ? "font-mono" : ""
        }`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function extraField(
  existing: TenantSsoProviderResponse,
  key: string,
): string | null {
  const v = existing.extra_config?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}
