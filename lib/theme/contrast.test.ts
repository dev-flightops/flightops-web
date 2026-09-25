import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  readableTextOn,
  relativeLuminance,
  TEXT_ON_FILL,
} from "./contrast";

describe("contrast", () => {
  it("matches the WCAG reference values", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    // Symmetric.
    expect(contrastRatio("#3b82f6", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#3b82f6"),
      10,
    );
  });

  it("puts dark text on the mid-tones white fails on", () => {
    // The calendar's old default and a seeded unit colour.
    expect(contrastRatio("#ffffff", "#3b82f6")).toBeLessThan(4.5);
    expect(readableTextOn("#3b82f6")).toBe(TEXT_ON_FILL.dark);
    expect(readableTextOn("#22c55e")).toBe(TEXT_ON_FILL.dark);
    expect(readableTextOn("#fbbf24")).toBe(TEXT_ON_FILL.dark);
  });

  it("keeps white text on deep fills", () => {
    expect(readableTextOn("#1d4ed8")).toBe(TEXT_ON_FILL.light);
    expect(readableTextOn("#ab2429")).toBe(TEXT_ON_FILL.light);
    expect(readableTextOn("#0a0a0a")).toBe(TEXT_ON_FILL.light);
  });

  it("the choice always clears AA for text on a fully saturated or grey fill", () => {
    // Sweep the hue wheel and a grey ramp. The worst fill is the one
    // equidistant from white and black, at ~4.58:1 — the floor.
    const fills: string[] = [];
    for (let h = 0; h < 360; h += 15) {
      for (const l of [0.25, 0.5, 0.75]) fills.push(hslHex(h, 1, l));
    }
    for (let g = 0; g <= 255; g += 17) {
      const x = g.toString(16).padStart(2, "0");
      fills.push(`#${x}${x}${x}`);
    }
    for (const fill of fills) {
      expect(contrastRatio(readableTextOn(fill), fill)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("refuses anything but #rrggbb", () => {
    expect(() => relativeLuminance("#fff")).toThrow();
    expect(() => relativeLuminance("red")).toThrow();
  });
});

function hslHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
