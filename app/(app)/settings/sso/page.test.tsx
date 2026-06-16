import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ProviderCatalogEntry,
  TenantSsoProviderResponse,
} from "@/lib/api/types";

const { TestApiError, getSsoCatalog, listSsoProviders } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    TestApiError,
    getSsoCatalog: vi.fn(),
    listSsoProviders: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/auth", () => ({ getSsoCatalog, listSsoProviders }));
vi.mock("@/components/settings/sso/configure-provider-dialog", () => ({
  ConfigureProviderDialog: ({
    catalog,
    existing,
    ctaLabel,
  }: {
    catalog: ProviderCatalogEntry;
    existing: TenantSsoProviderResponse | null;
    ctaLabel: string;
  }) => (
    <div
      data-testid={`configure-${catalog.id}`}
      data-cta={ctaLabel}
      data-has-existing={existing ? "true" : "false"}
    />
  ),
}));
vi.mock("@/components/settings/sso/disconnect-provider-button", () => ({
  DisconnectProviderButton: ({ providerId }: { providerId: string }) => (
    <div data-testid={`disconnect-${providerId}`} />
  ),
}));

import SettingsSsoPage from "./page";

const CATALOG: ProviderCatalogEntry[] = [
  { id: "google", label: "Google" },
  { id: "microsoft-entra-id", label: "Microsoft" },
  { id: "okta", label: "Okta" },
];

function makeProvider(
  overrides: Partial<TenantSsoProviderResponse>,
): TenantSsoProviderResponse {
  return {
    id: "p-1",
    provider_id: "google",
    display_name: null,
    client_id: "client-abc",
    has_secret: true,
    extra_config: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  getSsoCatalog.mockReset();
  listSsoProviders.mockReset();
});

describe("SettingsSsoPage (M2-G-settings-sso-admin)", () => {
  it("renders one card per catalog entry with Connect/Edit CTA", async () => {
    getSsoCatalog.mockResolvedValueOnce({ providers: CATALOG });
    listSsoProviders.mockResolvedValueOnce({
      items: [makeProvider({ provider_id: "google" })],
      total: 1,
    });

    const ui = await SettingsSsoPage();
    render(ui);

    expect(
      screen.getByRole("heading", { name: /sso & integrations/i, level: 1 }),
    ).toBeInTheDocument();

    // Google is configured → Edit CTA + Disconnect button
    expect(screen.getByTestId("configure-google")).toHaveAttribute(
      "data-cta",
      "Edit",
    );
    expect(screen.getByTestId("configure-google")).toHaveAttribute(
      "data-has-existing",
      "true",
    );
    expect(screen.getByTestId("disconnect-google")).toBeInTheDocument();

    // The two others are not configured → Connect CTA, no Disconnect
    expect(screen.getByTestId("configure-microsoft-entra-id")).toHaveAttribute(
      "data-cta",
      "Connect",
    );
    expect(
      screen.queryByTestId("disconnect-microsoft-entra-id"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("configure-okta")).toHaveAttribute(
      "data-cta",
      "Connect",
    );
  });

  it("shows the Connected badge for active + has_secret providers", async () => {
    getSsoCatalog.mockResolvedValueOnce({ providers: CATALOG });
    listSsoProviders.mockResolvedValueOnce({
      items: [makeProvider({})],
      total: 1,
    });

    const ui = await SettingsSsoPage();
    render(ui);

    // "Connected" badge is uppercase-tracked; assert by exact-string
    // match (regex would also catch the lowercase "connected" in the
    // footnote paragraph below).
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows the Inactive badge when is_active=false", async () => {
    getSsoCatalog.mockResolvedValueOnce({ providers: CATALOG });
    listSsoProviders.mockResolvedValueOnce({
      items: [makeProvider({ is_active: false })],
      total: 1,
    });

    const ui = await SettingsSsoPage();
    render(ui);

    expect(screen.getByText(/inactive/i)).toBeInTheDocument();
  });

  it("renders the Microsoft Entra tenant_id when stored in extra_config", async () => {
    getSsoCatalog.mockResolvedValueOnce({ providers: CATALOG });
    listSsoProviders.mockResolvedValueOnce({
      items: [
        makeProvider({
          provider_id: "microsoft-entra-id",
          extra_config: { tenant_id: "abc-tenant-uuid" },
        }),
      ],
      total: 1,
    });

    const ui = await SettingsSsoPage();
    render(ui);

    expect(screen.getByText("abc-tenant-uuid")).toBeInTheDocument();
  });

  it("renders the Okta domain when stored in extra_config", async () => {
    getSsoCatalog.mockResolvedValueOnce({ providers: CATALOG });
    listSsoProviders.mockResolvedValueOnce({
      items: [
        makeProvider({
          provider_id: "okta",
          extra_config: { domain: "acme.okta.com" },
        }),
      ],
      total: 1,
    });

    const ui = await SettingsSsoPage();
    render(ui);

    expect(screen.getByText("acme.okta.com")).toBeInTheDocument();
  });

  it("shows the exec_admin warning on 403", async () => {
    getSsoCatalog.mockRejectedValueOnce(
      new TestApiError(403, "/sso/catalog", "x"),
    );
    listSsoProviders.mockRejectedValueOnce(
      new TestApiError(403, "/sso/providers", "x"),
    );

    const ui = await SettingsSsoPage();
    render(ui);

    expect(screen.getByRole("alert")).toHaveTextContent(/executive admin/i);
  });

  it("shows session-expired on 401", async () => {
    getSsoCatalog.mockRejectedValueOnce(
      new TestApiError(401, "/sso/catalog", "expired"),
    );
    listSsoProviders.mockResolvedValueOnce({ items: [], total: 0 });

    const ui = await SettingsSsoPage();
    render(ui);

    expect(screen.getByRole("alert")).toHaveTextContent(/session expired/i);
  });
});
