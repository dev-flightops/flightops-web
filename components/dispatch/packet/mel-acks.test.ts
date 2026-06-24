import { describe, expect, it } from "vitest";

import { parseAckedMelIds, serializeAckedMelIds } from "./mel-acks";

describe("parseAckedMelIds", () => {
  it("returns [] for missing / empty input", () => {
    expect(parseAckedMelIds(undefined)).toEqual([]);
    expect(parseAckedMelIds(null)).toEqual([]);
    expect(parseAckedMelIds("")).toEqual([]);
  });

  it("splits comma-separated ids", () => {
    expect(parseAckedMelIds("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("trims whitespace", () => {
    expect(parseAckedMelIds("  a , b ,c ")).toEqual(["a", "b", "c"]);
  });

  it("dedupes", () => {
    expect(parseAckedMelIds("a,b,a,c,b")).toEqual(["a", "b", "c"]);
  });

  it("drops empty segments", () => {
    expect(parseAckedMelIds("a,,b,")).toEqual(["a", "b"]);
  });
});

describe("serializeAckedMelIds", () => {
  it("returns '' for empty iterable", () => {
    expect(serializeAckedMelIds([])).toBe("");
  });

  it("sorts alphabetically so toggling doesn't churn the URL", () => {
    expect(serializeAckedMelIds(["c", "a", "b"])).toBe("a,b,c");
  });

  it("dedupes", () => {
    expect(serializeAckedMelIds(["a", "b", "a"])).toBe("a,b");
  });
});
