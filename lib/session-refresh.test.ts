import { describe, expect, it, vi } from "vitest";

import {
  decideSessionAction,
  refreshAccessToken,
  REFRESH_MARGIN_SECONDS,
  type AccessTokenClaims,
} from "./session-refresh";

const NOW = 1_800_000_000;

function claims(over: Partial<AccessTokenClaims> = {}): AccessTokenClaims {
  return {
    sub: "u-1",
    tenant_id: "t-1",
    roles: ["dispatcher"],
    admin_access: false,
    exp: NOW + 3600,
    ...over,
  };
}

describe("decideSessionAction", () => {
  it("keeps a token that is nowhere near expiry", () => {
    expect(
      decideSessionAction({ exp: NOW + 3600, hasRefreshToken: true, nowSeconds: NOW }),
    ).toBe("keep");
  });

  it("refreshes inside the margin, before anything can 401", () => {
    // The margin is the point: refreshing only after expiry means every
    // request in flight at that moment fails.
    expect(
      decideSessionAction({
        exp: NOW + REFRESH_MARGIN_SECONDS - 1,
        hasRefreshToken: true,
        nowSeconds: NOW,
      }),
    ).toBe("refresh");
  });

  it("refreshes an already-expired token rather than giving up", () => {
    // A laptop reopened after lunch. There is a valid refresh token, so
    // the session is recoverable without a login.
    expect(
      decideSessionAction({ exp: NOW - 600, hasRefreshToken: true, nowSeconds: NOW }),
    ).toBe("refresh");
  });

  it("keeps a still-valid token that has no refresh path", () => {
    // SSO and tenant-switch sessions have no refresh token. Cutting them
    // a minute early would be a regression — they are fine until they
    // actually expire.
    expect(
      decideSessionAction({
        exp: NOW + REFRESH_MARGIN_SECONDS - 1,
        hasRefreshToken: false,
        nowSeconds: NOW,
      }),
    ).toBe("keep");
  });

  it("expires only when there is genuinely nothing left", () => {
    expect(
      decideSessionAction({ exp: NOW - 1, hasRefreshToken: false, nowSeconds: NOW }),
    ).toBe("expire");
  });

  it("keeps a token with no exp claim rather than guessing", () => {
    // Old or malformed. The backend still rejects it if it is dead;
    // throwing the session away here would log people out over a
    // missing field.
    expect(
      decideSessionAction({ exp: undefined, hasRefreshToken: true, nowSeconds: NOW }),
    ).toBe("keep");
  });
});

describe("refreshAccessToken", () => {
  const decode = () => claims();

  function fetchReturning(body: unknown, ok = true) {
    return vi.fn().mockResolvedValue({
      ok,
      json: async () => body,
    }) as unknown as typeof fetch;
  }

  it("posts the refresh token and returns the new session", async () => {
    const fetchImpl = fetchReturning({
      access_token: "new.access.token",
      refresh_token: "pfo_rt_new",
    });
    const result = await refreshAccessToken("pfo_rt_old", {
      apiBaseUrl: "https://api.test",
      fetchImpl,
      decode,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.test/auth/refresh",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh_token: "pfo_rt_old" }),
      }),
    );
    expect(result?.access_token).toBe("new.access.token");
  });

  it("carries the ROTATED refresh token forward, not the old one", async () => {
    // Rotation means the presented token dies the instant this
    // succeeds. Keeping it would present a revoked token next time,
    // which trips reuse detection and revokes the whole family — the
    // user gets signed out everywhere.
    const result = await refreshAccessToken("pfo_rt_old", {
      apiBaseUrl: "https://api.test",
      fetchImpl: fetchReturning({
        access_token: "a.b.c",
        refresh_token: "pfo_rt_rotated",
      }),
      decode,
    });
    expect(result?.refresh_token).toBe("pfo_rt_rotated");
    expect(result?.refresh_token).not.toBe("pfo_rt_old");
  });

  it("re-reads roles and admin_access from the fresh token", async () => {
    // So a role change or an admin-access toggle lands at the next
    // refresh instead of waiting for a full re-login.
    const result = await refreshAccessToken("pfo_rt_old", {
      apiBaseUrl: "https://api.test",
      fetchImpl: fetchReturning({ access_token: "a.b.c" }),
      decode: () => claims({ roles: ["exec_admin"], admin_access: true }),
    });
    expect(result?.roles).toEqual(["exec_admin"]);
    expect(result?.admin_access).toBe(true);
  });

  it("returns null when the backend refuses", async () => {
    const result = await refreshAccessToken("pfo_rt_dead", {
      apiBaseUrl: "https://api.test",
      fetchImpl: fetchReturning({ detail: "invalid_refresh_token" }, false),
      decode,
    });
    expect(result).toBeNull();
  });

  it("returns null when the backend is unreachable", async () => {
    // Distinct from "refused" for the caller: inside the margin the
    // existing token still works, so a network blip must not end the
    // session.
    const result = await refreshAccessToken("pfo_rt_old", {
      apiBaseUrl: "https://api.test",
      fetchImpl: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch,
      decode,
    });
    expect(result).toBeNull();
  });

  it("returns null on a malformed response rather than throwing", async () => {
    const result = await refreshAccessToken("pfo_rt_old", {
      apiBaseUrl: "https://api.test",
      fetchImpl: fetchReturning({ nonsense: true }),
      decode,
    });
    expect(result).toBeNull();
  });

  it("does not call out at all with no API base configured", async () => {
    const fetchImpl = fetchReturning({});
    const result = await refreshAccessToken("pfo_rt_old", {
      apiBaseUrl: "",
      fetchImpl,
      decode,
    });
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
