import { describe, expect, it } from "vitest";

import { hoursMinutes, pilotMinutesLine, signErrorMessage } from "./signoff-text";

describe("the FRAT sign-off's words (#155)", () => {
  it("writes minutes as hours and minutes", () => {
    expect(hoursMinutes(95)).toBe("1 h 35 min");
    expect(hoursMinutes(0)).toBe("0 h 00 min");
    expect(hoursMinutes(null)).toBe("not known");
  });

  it("gives the pilot's flight time for the day, as the client asked", () => {
    expect(pilotMinutesLine(95, 385)).toBe(
      "Flight time in the 24 hours before signing: 1 h 35 min flown, 6 h 25 min remaining (14 CFR 135.265(a)(1)).",
    );
  });

  it("explains each refusal", () => {
    expect(signErrorMessage('{"detail":{"error":"frat_changed"}}')).toMatch(/changed since you opened it/);
    expect(signErrorMessage('{"detail":{"error":"same_person_signs_both"}}')).toMatch(/someone else signs/);
    expect(signErrorMessage('{"detail":{"error":"frat_locked"}}')).toMatch(/Pull the release back/);
  });
});
