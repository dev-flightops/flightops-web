import { describe, expect, it } from "vitest";

import {
  SIGNED_OUT_COOKIE,
  SIGNED_OUT_MAX_AGE_SECONDS,
  sessionStart,
  signedOutHeader,
  signedOutSince,
  withoutSessionCookies,
} from "./signed-out";

describe("a session from before this browser's last sign-out (#201)", () => {
  it("is refused when the sign-out came at or after its start", () => {
    expect(signedOutSince(1_000, "2000")).toBe(true);
    expect(signedOutSince(2_000, "2000")).toBe(true);
  });

  it("stands when it began after the sign-out, or there was none", () => {
    expect(signedOutSince(3_000, "2000")).toBe(false);
    expect(signedOutSince(3_000, undefined)).toBe(false);
    expect(signedOutSince(3_000, "")).toBe(false);
    expect(signedOutSince(3_000, "not a time")).toBe(false);
  });

  it("counts a session from before the mark existed as begun at 0", () => {
    expect(signedOutSince(undefined, "2000")).toBe(true);
    expect(signedOutSince("1999", "2000")).toBe(true);
    expect(signedOutSince(undefined, undefined)).toBe(false);
  });
});

describe("a new session's start", () => {
  it("is now, after the last sign-out", () => {
    expect(sessionStart("1000", 5_000)).toBe(5_000);
    expect(sessionStart(undefined, 5_000)).toBe(5_000);
  });

  it("comes after the sign-out even on a server whose clock is behind", () => {
    expect(sessionStart("5000", 4_990)).toBe(5_001);
    expect(sessionStart("5000", 5_000)).toBe(5_001);
    expect(signedOutSince(sessionStart("5000", 4_990), "5000")).toBe(false);
  });
});

describe("the mark as a header", () => {
  it("lives as long as a session and only for this site", () => {
    expect(signedOutHeader(1234)).toBe(
      `${SIGNED_OUT_COOKIE}=1234; Path=/; Max-Age=${SIGNED_OUT_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax`,
    );
  });
});

describe("the request the proxy passes on for a refused session", () => {
  it("has no session in it, whole or in chunks, and keeps the rest", () => {
    expect(
      withoutSessionCookies(
        "a=1; __Secure-authjs.session-token=abc; __Host-authjs.csrf-token=x; fo_signed_out_at=5",
      ),
    ).toBe("a=1; __Host-authjs.csrf-token=x; fo_signed_out_at=5");
    expect(withoutSessionCookies("authjs.session-token.0=a; authjs.session-token.1=b")).toBe("");
  });

  it("is left alone when there is no session to take", () => {
    expect(withoutSessionCookies("a=1; fo_signed_out_at=5")).toBeNull();
    expect(withoutSessionCookies(null)).toBeNull();
    expect(withoutSessionCookies("")).toBeNull();
  });
});
