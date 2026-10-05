import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXCHANGE_SECRET_HEADER, postOAuthExchange } from "./sso-exchange";

const identity = { provider: "google", providerUserId: "g-1", email: "pilot@acme.local" };
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("postOAuthExchange (30 Sep)", () => {
  it("presents the shared secret with the identity", async () => {
    vi.stubEnv("AUTH_EXCHANGE_SECRET", "s3cret-s3cret-s3cret-s3cret-s3cret");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "a.b.c" }), { status: 200 }),
    );

    expect(await postOAuthExchange("https://api.example", identity)).toEqual({
      access_token: "a.b.c",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example/auth/oauth-exchange");
    expect(init.headers[EXCHANGE_SECRET_HEADER]).toBe("s3cret-s3cret-s3cret-s3cret-s3cret");
    expect(JSON.parse(init.body)).toEqual({
      provider: "google",
      provider_user_id: "g-1",
      email: "pilot@acme.local",
    });
  });

  it("is off, and calls nothing, without the secret", async () => {
    vi.stubEnv("AUTH_EXCHANGE_SECRET", "");
    expect(await postOAuthExchange("https://api.example", identity)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns nothing when auth-service refuses", async () => {
    vi.stubEnv("AUTH_EXCHANGE_SECRET", "s3cret-s3cret-s3cret-s3cret-s3cret");
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 403 }));
    expect(await postOAuthExchange("https://api.example", identity)).toBeNull();
  });
});
