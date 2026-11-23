import { describe, expect, it } from "vitest";

import { EMPTY_SIGN_OFF, signOffProblem, toClosure } from "./sign-off-fields";

const FILLED = {
  ...EMPTY_SIGN_OFF,
  workDone: " Replaced bulb. ",
  signerName: " Ray Torres ",
  certNumber: " 3521876 ",
  certType: "ap" as const,
  airworthy: true,
};

describe("the sign-off (1119-19)", () => {
  it("names everything a 14 CFR 43.9 entry still lacks", () => {
    expect(signOffProblem(EMPTY_SIGN_OFF)).toBe(
      "The sign-off needs the work done, the mechanic's name, their certificate number, the kind of certificate.",
    );
    expect(signOffProblem({ ...FILLED, airworthy: false })).toBe(
      "Tick the statement that the work leaves the aircraft airworthy.",
    );
    expect(signOffProblem(FILLED)).toBeNull();
  });

  it("sends the signed fields trimmed, or the reason no work was done", () => {
    expect(toClosure(FILLED)).toEqual({
      sign_off: { work_done: "Replaced bulb.", signer_name: "Ray Torres", cert_number: "3521876", cert_type: "ap", airworthy: true },
    });
    const none = { ...EMPTY_SIGN_OFF, mode: "no_work" as const, reason: " Opened in error. " };
    expect(signOffProblem({ ...none, reason: "  " })).toBe("Say why no work was done.");
    expect(toClosure(none)).toEqual({ no_work_reason: "Opened in error." });
  });
});
