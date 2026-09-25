/**
 * WCAG contrast, for text drawn on a colour a user picked.
 *
 * A housing unit's accent colour is the operator's choice, and the
 * calendar prints initials on it. White on a mid-tone does not read
 * (white on the old default #3b82f6 is 3.7:1, on a green 2.3:1), so the
 * text colour is chosen from the fill rather than assumed.
 */

const HEX = /^#([0-9a-f]{6})$/i;

/** WCAG 2 relative luminance of a #rrggbb colour. */
export function relativeLuminance(hex: string): number {
  const m = HEX.exec(hex);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  const n = parseInt(m[1], 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Text colours for a coloured fill. Dark is pure black rather than the
 *  theme's #171717: with black the worse of the two choices is still
 *  ≥ 4.58:1 on any fill, while #171717 bottoms out near 4.2:1 on a
 *  mid-tone. On a coloured fill the two are indistinguishable. */
export const TEXT_ON_FILL = { light: "#ffffff", dark: "#000000" } as const;

/** Whichever of white or black reads better on `fill`. */
export function readableTextOn(fill: string): string {
  return contrastRatio(TEXT_ON_FILL.light, fill) >=
    contrastRatio(TEXT_ON_FILL.dark, fill)
    ? TEXT_ON_FILL.light
    : TEXT_ON_FILL.dark;
}
