import { describe, expect, it } from "vitest";

import { currentGreeting, firstNameFrom, greetingForHour } from "./greeting";

describe("greetingForHour", () => {
  it.each([
    [5, "Good morning"],
    [8, "Good morning"],
    [11, "Good morning"],
    [12, "Good afternoon"],
    [15, "Good afternoon"],
    [17, "Good afternoon"],
    [18, "Good evening"],
    [22, "Good evening"],
    [0, "Good evening"],
    [4, "Good evening"],
  ])("hour %i → %s", (hour, expected) => {
    expect(greetingForHour(hour)).toBe(expected);
  });
});

describe("firstNameFrom", () => {
  it("returns the first whitespace-separated token", () => {
    expect(firstNameFrom("Greg Harezlak")).toBe("Greg");
    expect(firstNameFrom("Marc Mulgrum-Smith")).toBe("Marc");
  });

  it("trims surrounding whitespace", () => {
    expect(firstNameFrom("  Greg   ")).toBe("Greg");
  });

  it("returns empty string for null / undefined / empty", () => {
    expect(firstNameFrom(null)).toBe("");
    expect(firstNameFrom(undefined)).toBe("");
    expect(firstNameFrom("")).toBe("");
    expect(firstNameFrom("   ")).toBe("");
  });
});

describe("currentGreeting (#157)", () => {
  it("greets by the hour in Alaska, not the server's", () => {
    // 15:30Z on 30 Oct is 07:30 AKDT: the client got "Good afternoon".
    expect(currentGreeting(new Date("2026-10-30T15:30:00Z"))).toBe("Good morning");
    expect(currentGreeting(new Date("2026-10-30T23:30:00Z"))).toBe("Good afternoon");
  });
});
