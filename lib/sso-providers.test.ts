import { describe, expect, it } from "vitest";

import { ssoProfileAllowed, ssoProviderConfigs, usableProviders } from "./sso-providers";

/** SSO providers this deployment can use, and who they may sign in (#11). */

const TENANT = "0f3c1a2b-4d5e-6f70-8192-a3b4c5d6e7f8";
const ENTRA = {
  AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID: "entra-app",
  AUTH_MICROSOFT_ENTRA_ID_CLIENT_SECRET: "entra-secret",
};

describe("ssoProviderConfigs", () => {
  it("passes our names on as the client id and secret", () => {
    expect(
      ssoProviderConfigs({ AUTH_GOOGLE_CLIENT_ID: "g-id", AUTH_GOOGLE_CLIENT_SECRET: "g-secret" }),
    ).toEqual([{ id: "google", clientId: "g-id", clientSecret: "g-secret" }]);
  });

  it("needs both halves, and ignores Auth.js's own names", () => {
    expect(ssoProviderConfigs({ AUTH_GOOGLE_CLIENT_ID: "g-id" })).toEqual([]);
    expect(ssoProviderConfigs({ AUTH_GOOGLE_ID: "g-id", AUTH_GOOGLE_SECRET: "g-secret" })).toEqual([]);
  });

  it("turns Entra on only when pinned to one tenant", () => {
    expect(ssoProviderConfigs(ENTRA)).toEqual([]);
    for (const shared of ["common", "organizations", "consumers"]) {
      const issuer = `https://login.microsoftonline.com/${shared}/v2.0`;
      expect(ssoProviderConfigs({ ...ENTRA, AUTH_MICROSOFT_ENTRA_ID_ISSUER: issuer })).toEqual([]);
    }
    const issuer = `https://login.microsoftonline.com/${TENANT.toUpperCase()}/v2.0`;
    expect(ssoProviderConfigs({ ...ENTRA, AUTH_MICROSOFT_ENTRA_ID_ISSUER: issuer })).toEqual([
      {
        id: "microsoft-entra-id",
        clientId: "entra-app",
        clientSecret: "entra-secret",
        issuer,
        tenantId: TENANT,
      },
    ]);
  });

  it("turns Okta on only with its org's https issuer", () => {
    const okta = { AUTH_OKTA_CLIENT_ID: "o-id", AUTH_OKTA_CLIENT_SECRET: "o-secret" };
    expect(ssoProviderConfigs(okta)).toEqual([]);
    expect(ssoProviderConfigs({ ...okta, AUTH_OKTA_ISSUER: "http://acme.okta.com" })).toEqual([]);
    expect(ssoProviderConfigs({ ...okta, AUTH_OKTA_ISSUER: "https://acme.okta.com" })).toEqual([
      { id: "okta", clientId: "o-id", clientSecret: "o-secret", issuer: "https://acme.okta.com" },
    ]);
  });
});

describe("ssoProfileAllowed", () => {
  const configs = ssoProviderConfigs({
    ...ENTRA,
    AUTH_MICROSOFT_ENTRA_ID_ISSUER: `https://login.microsoftonline.com/${TENANT}/v2.0`,
    AUTH_GOOGLE_CLIENT_ID: "g-id",
    AUTH_GOOGLE_CLIENT_SECRET: "g-secret",
  });

  it("refuses an email Google hasn't verified", () => {
    expect(ssoProfileAllowed("google", { email_verified: true }, configs)).toBe(true);
    expect(ssoProfileAllowed("google", { email_verified: false }, configs)).toBe(false);
    expect(ssoProfileAllowed("google", { email_verified: "true" }, configs)).toBe(false);
    expect(ssoProfileAllowed("google", {}, configs)).toBe(false);
    expect(ssoProfileAllowed("google", undefined, configs)).toBe(false);
  });

  it("refuses a user from another Entra tenant", () => {
    expect(ssoProfileAllowed("microsoft-entra-id", { tid: TENANT.toUpperCase() }, configs)).toBe(true);
    expect(
      ssoProfileAllowed("microsoft-entra-id", { tid: "11111111-2222-3333-4444-555555555555" }, configs),
    ).toBe(false);
    expect(ssoProfileAllowed("microsoft-entra-id", {}, configs)).toBe(false);
    // Not pinned here, so nobody comes in through Entra.
    expect(ssoProfileAllowed("microsoft-entra-id", { tid: TENANT }, [])).toBe(false);
  });

  it("refuses a provider this deployment doesn't have", () => {
    expect(ssoProfileAllowed("okta", {}, configs)).toBe(false);
  });
});

describe("usableProviders", () => {
  it("keeps only the listed providers this deployment can sign people in with", () => {
    const configs = ssoProviderConfigs({ AUTH_GOOGLE_CLIENT_ID: "g", AUTH_GOOGLE_CLIENT_SECRET: "s" });
    const listed = [
      { id: "google", label: "Google" },
      { id: "microsoft-entra-id", label: "Microsoft" },
    ];
    expect(usableProviders(listed, configs)).toEqual([{ id: "google", label: "Google" }]);
  });
});
