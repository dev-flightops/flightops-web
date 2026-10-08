import type { SsoProviderId } from "@/lib/api/types";

/**
 * The SSO providers this deployment can actually sign someone in with
 * (#11), and the checks on what a provider says about a person.
 *
 * Names: AUTH_<NAME>_CLIENT_ID and AUTH_<NAME>_CLIENT_SECRET, the names
 * auth-service reads to list the providers (services/auth/app/providers.py),
 * so a deployment sets one set of names in both places. They're handed to
 * Auth.js explicitly: left to itself it reads AUTH_<NAME>_ID and
 * AUTH_<NAME>_SECRET, so a provider set up under our names showed a button
 * that could never sign anyone in.
 *
 * Microsoft Entra ID is on only with AUTH_MICROSOFT_ENTRA_ID_ISSUER pinned
 * to one tenant (https://login.microsoftonline.com/<tenant id>/v2.0).
 * Without it Auth.js uses the /common/ issuer and accepts users of every
 * Entra tenant. Okta needs its org's issuer URL (AUTH_OKTA_ISSUER).
 */

export interface SsoProviderConfig {
  id: SsoProviderId;
  clientId: string;
  clientSecret: string;
  issuer?: string;
  /** Entra only: the one tenant whose users may sign in. */
  tenantId?: string;
}

type Env = Record<string, string | undefined>;

const ENTRA_TENANT_ISSUER =
  /^https:\/\/login\.microsoftonline\.com\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/v2\.0\/?$/i;

function credentials(env: Env, name: string): { clientId: string; clientSecret: string } | null {
  const clientId = env[`AUTH_${name}_CLIENT_ID`]?.trim();
  const clientSecret = env[`AUTH_${name}_CLIENT_SECRET`]?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function ssoProviderConfigs(env: Env = process.env): SsoProviderConfig[] {
  const configs: SsoProviderConfig[] = [];
  const google = credentials(env, "GOOGLE");
  if (google) configs.push({ id: "google", ...google });

  const entra = credentials(env, "MICROSOFT_ENTRA_ID");
  const entraIssuer = env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim();
  const tenantId = entraIssuer?.match(ENTRA_TENANT_ISSUER)?.[1]?.toLowerCase();
  if (entra && entraIssuer && tenantId) {
    configs.push({ id: "microsoft-entra-id", ...entra, issuer: entraIssuer, tenantId });
  }

  const okta = credentials(env, "OKTA");
  const oktaIssuer = env.AUTH_OKTA_ISSUER?.trim();
  if (okta && oktaIssuer?.startsWith("https://")) {
    configs.push({ id: "okta", ...okta, issuer: oktaIssuer });
  }
  return configs;
}

/**
 * Whether a provider's account of a person may go on to the exchange.
 * Google: only an address Google has verified (defence in depth; nobody
 * can get Google to verify another person's address). Entra: only the
 * pinned tenant's users, by the token's `tid`, on top of the issuer check
 * Auth.js does with the pinned issuer.
 */
export function ssoProfileAllowed(
  provider: string,
  profile: Record<string, unknown> | undefined,
  configs: SsoProviderConfig[],
): boolean {
  if (provider === "google") return profile?.email_verified === true;
  if (provider === "microsoft-entra-id") {
    const tenantId = configs.find((c) => c.id === "microsoft-entra-id")?.tenantId;
    const tid = profile?.tid;
    return Boolean(tenantId) && typeof tid === "string" && tid.toLowerCase() === tenantId;
  }
  return configs.some((c) => c.id === provider);
}

/** The providers auth-service lists that this deployment can also use, so
 *  the login page never shows a button that can't sign anyone in. */
export function usableProviders<T extends { id: string }>(
  listed: T[],
  configs: SsoProviderConfig[] = ssoProviderConfigs(),
): T[] {
  const usable = new Set(configs.map((c) => c.id as string));
  return listed.filter((p) => usable.has(p.id));
}
