import { describe, expect, it } from "vitest";

import { extractBlockingSummary } from "./release-errors";

describe("extractBlockingSummary", () => {
  it("returns a single description when there is one blocking issue", () => {
    const body = JSON.stringify({
      detail: {
        error: "aircraft_not_airworthy",
        blocking_issues: [
          { kind: "grounding_squawk", description: "Engine oil pressure low" },
        ],
      },
    });
    expect(extractBlockingSummary(body)).toBe("Engine oil pressure low");
  });

  it("joins two descriptions with a semicolon", () => {
    const body = JSON.stringify({
      detail: {
        error: "aircraft_not_airworthy",
        blocking_issues: [
          { kind: "grounding_squawk", description: "Engine oil pressure low" },
          {
            kind: "expired_mel",
            description: "MEL 21-30: Cabin pressurization controller intermittent",
          },
        ],
      },
    });
    expect(extractBlockingSummary(body)).toBe(
      "Engine oil pressure low; MEL 21-30: Cabin pressurization controller intermittent",
    );
  });

  it("caps at 2 + '(+N more)' so the inline error fits on one line", () => {
    const body = JSON.stringify({
      detail: {
        error: "aircraft_not_airworthy",
        blocking_issues: [
          { kind: "grounding_squawk", description: "first issue" },
          { kind: "expired_mel", description: "second issue" },
          { kind: "expired_mel", description: "third issue" },
          { kind: "expired_mel", description: "fourth issue" },
        ],
      },
    });
    expect(extractBlockingSummary(body)).toBe(
      "first issue; second issue (+2 more)",
    );
  });

  it("returns null when the body has no blocking_issues", () => {
    expect(extractBlockingSummary("{}")).toBeNull();
    expect(
      extractBlockingSummary(
        JSON.stringify({ detail: { error: "aircraft_not_airworthy" } }),
      ),
    ).toBeNull();
  });

  it("returns null when blocking_issues exists but has no descriptions", () => {
    const body = JSON.stringify({
      detail: {
        blocking_issues: [{ kind: "grounding_squawk" }],
      },
    });
    expect(extractBlockingSummary(body)).toBeNull();
  });

  it("returns null for invalid JSON (e.g. plain-text error body)", () => {
    expect(extractBlockingSummary("aircraft_not_airworthy")).toBeNull();
    expect(extractBlockingSummary("")).toBeNull();
  });
});
