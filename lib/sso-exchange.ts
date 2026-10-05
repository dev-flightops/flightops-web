/**
 * The server-side half of SSO sign-in: after Auth.js completes the OAuth
 * round-trip, hand the verified identity to auth-service for a FlightOps
 * access token.
 *
 * auth-service trusts the email it is handed, so it takes the exchange only
 * from a caller presenting AUTH_EXCHANGE_SECRET (30 Sep): this server,
 * which ran the round-trip. Without the secret, SSO sign-in is off rather
 * than open. Never send it from the browser.
 */

export const EXCHANGE_SECRET_HEADER = "X-FlightOps-Exchange-Secret";

export interface OAuthIdentity {
  provider: string;
  providerUserId: string;
  email: string;
}

export async function postOAuthExchange(
  apiBaseUrl: string,
  identity: OAuthIdentity,
): Promise<{ access_token: string } | null> {
  const secret = process.env.AUTH_EXCHANGE_SECRET;
  if (!secret) return null;
  const response = await fetch(`${apiBaseUrl}/auth/oauth-exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [EXCHANGE_SECRET_HEADER]: secret,
    },
    body: JSON.stringify({
      provider: identity.provider,
      provider_user_id: identity.providerUserId,
      email: identity.email,
    }),
  });
  if (!response.ok) return null;
  return (await response.json()) as { access_token: string };
}
