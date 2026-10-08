import { describe, expect, it } from "vitest";

import { lockoutMinutes, loginErrorMessage, tooManyAttemptsCode, tooManyAttemptsMessage } from "./login-errors";

describe("sign-in lockout messages (#16)", () => {
  it.each([
    ["900", 15],
    ["61", 2],
    ["30", 1],
    [null, 15],
    ["soon", 15],
    ["0", 15],
  ])("Retry-After %s is %i minutes to wait", (retryAfter, minutes) => {
    expect(lockoutMinutes(retryAfter)).toBe(minutes);
  });

  it("turns a lockout code into how long to wait", () => {
    expect(loginErrorMessage(tooManyAttemptsCode(12))).toBe(
      "Too many failed sign-in attempts. Try again in 12 minutes.",
    );
    expect(tooManyAttemptsMessage(1)).toBe("Too many failed sign-in attempts. Try again in 1 minute.");
  });

  it("says nothing more than 'invalid' for any other failure", () => {
    for (const code of [undefined, null, "", "credentials", "too_many_attempts", "too_many_attempts:x"]) {
      expect(loginErrorMessage(code)).toBe("Invalid email or password.");
    }
  });
});
