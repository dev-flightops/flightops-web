import { describe, expect, it } from "vitest";

import { brandTones, DEFAULT_BRAND, isBrandHex } from "./brand";

describe("brandTones", () => {
  it("carries the default crimson as bare channels", () => {
    // Channels, not hex: Tailwind can only apply `/10` to channels.
    expect(brandTones(DEFAULT_BRAND).rgb).toBe("171 36 41");
  });

  it("derives the home page's hero coral as the on-ink tone", () => {
    // #ff6b6f (255 107 111) is what the home hero used for its eyebrow on
    // the dark photo — picked by eye, so its hue is a hair off the
    // brand's. The derivation uses the brand's exact hue and lands on
    // 255 107 113: imperceptibly different, and derived, which is what
    // lets another tenant's colour work on the same surface.
    const [r, g, b] = brandTones(DEFAULT_BRAND).lightRgb.split(" ").map(Number);
    for (const [got, want] of [[r, 255], [g, 107], [b, 111]]) {
      expect(Math.abs(got - want)).toBeLessThanOrEqual(3);
    }
  });

  it("derives a darker hover tone in the same hue", () => {
    const [r, g, b] = brandTones(DEFAULT_BRAND).darkRgb.split(" ").map(Number);
    expect(r).toBeLessThan(171);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  it("works for another tenant's colour", () => {
    // White-labelling: a blue tenant gets a blue theme, not a red one.
    const blue = brandTones("#1d4ed8");
    expect(blue.rgb).toBe("29 78 216");
    const [r, , b] = blue.lightRgb.split(" ").map(Number);
    expect(b).toBeGreaterThan(r);
  });

  it("keeps a greyscale brand greyscale on ink", () => {
    const [r, g, b] = brandTones("#333333").lightRgb.split(" ").map(Number);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("falls back to the default rather than emitting junk", () => {
    expect(brandTones("red").rgb).toBe("171 36 41");
    expect(brandTones("#abc").rgb).toBe("171 36 41");
  });
});

describe("isBrandHex", () => {
  it("accepts a plain six-digit hex only", () => {
    expect(isBrandHex("#AB2429")).toBe(true);
    expect(isBrandHex("#ab2429")).toBe(true);
  });

  it("refuses anything that could escape a <style> element", () => {
    // The value lands inside a style tag, so the check is an allowlist.
    for (const bad of ["red", "#abc", "#ab2429;}body{", "", null, undefined]) {
      expect(isBrandHex(bad)).toBe(false);
    }
  });
});
