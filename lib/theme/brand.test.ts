import { describe, expect, it } from "vitest";

import {
  brandTones,
  DEFAULT_BRAND,
  isBrandHex,
  MIN_CONTRAST_ON_WHITE,
} from "./brand";
import { contrastRatio } from "./contrast";

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

describe("a brand too light to carry white text", () => {
  const hue = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const h =
      max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };

  it("is darkened until white text and brand text both read", () => {
    for (const light of ["#f5c518", "#38bdf8", "#ff8fab", "#9ca3af"]) {
      const tones = brandTones(light);
      expect(tones.adjusted).toBe(true);
      expect(contrastRatio("#ffffff", tones.hex)).toBeGreaterThanOrEqual(
        MIN_CONTRAST_ON_WHITE,
      );
      expect(tones.rgb).toBe(
        [1, 3, 5].map((i) => parseInt(tones.hex.slice(i, i + 2), 16)).join(" "),
      );
    }
  });

  it("keeps its hue — a gold brand stays gold, only deeper", () => {
    const tones = brandTones("#f5c518");
    expect(Math.abs(hue(tones.hex) - hue("#f5c518"))).toBeLessThan(3);
  });

  it("leaves a brand that already reads exactly as chosen", () => {
    for (const ok of [DEFAULT_BRAND, "#c31117", "#1d4ed8", "#0f2a80"]) {
      const tones = brandTones(ok);
      expect(tones.adjusted).toBe(false);
      expect(tones.hex).toBe(ok);
    }
  });
});
