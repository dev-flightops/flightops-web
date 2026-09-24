import { describe, expect, it } from "vitest";

import { asNumber, asNumberOrNull } from "./decimal";

/**
 * The bug these guard against was live: the FRAT policy screen could
 * not be saved at all. Pydantic sends `Decimal` as a JSON string, the
 * TypeScript type said `number`, and the save guard's
 * `Number.isFinite("3.0")` is false — so the Chief Pilot got "the VFR
 * visibility floor has to be between 0 and 10 miles" about a value of
 * 3, unless they happened to retype that one field first.
 */
describe("asNumber", () => {
  it("parses the string a Decimal actually arrives as", () => {
    expect(asNumber("3.0")).toBe(3);
    expect(asNumber("0.5")).toBe(0.5);
    expect(asNumber("10")).toBe(10);
  });

  it("passes a real number through untouched", () => {
    expect(asNumber(3)).toBe(3);
    expect(asNumber(0)).toBe(0);
  });

  it("keeps zero a number rather than falling to a default", () => {
    // Zero is a real value for every field this touches — a visibility
    // floor of 0 means "do not score visibility". A falsy check here
    // would turn it into the default and change the policy.
    expect(asNumber("0")).toBe(0);
    expect(asNumber("0.0")).toBe(0);
  });

  it("throws rather than returning NaN", () => {
    // NaN propagates into a range check and reads as "out of range",
    // which is exactly how the original bug presented: a misleading
    // message about a value that was fine.
    expect(() => asNumber("not a number")).toThrow(TypeError);
    expect(() => asNumber(undefined)).toThrow(TypeError);
    expect(() => asNumber(null)).toThrow(TypeError);
  });
});

describe("asNumberOrNull", () => {
  it("keeps a genuinely absent value absent", () => {
    expect(asNumberOrNull(null)).toBeNull();
    expect(asNumberOrNull(undefined)).toBeNull();
  });

  it("still parses a present one", () => {
    expect(asNumberOrNull("2.5")).toBe(2.5);
    expect(asNumberOrNull("0")).toBe(0);
  });
});
