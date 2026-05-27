import { describe, expect, it } from "vitest";

import { cn, formatCurrency, formatDate } from "./utils";

describe("cn", () => {
  it("merges class strings", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("dedupes conflicting Tailwind classes (later wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "active")).toBe("base active");
  });

  it("handles arrays + objects", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
  });
});

describe("formatCurrency", () => {
  it("formats USD with 2 decimals", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("supports other currencies", () => {
    expect(formatCurrency(99, "EUR", "de-DE")).toContain("99,00");
  });
});

describe("formatDate", () => {
  it("formats a known date", () => {
    const result = formatDate("2026-05-27T14:30:00Z", { dateStyle: "short" }, "en-US");
    expect(result).toMatch(/5\/27\/26|5\/27\/2026/);
  });
});
