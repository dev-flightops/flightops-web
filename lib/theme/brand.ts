/**
 * A tenant's brand colour, in the forms the theme needs.
 *
 * The theme's single accent — every primary button, link, focus ring,
 * active tab and highlighted card — is the tenant's brand. It used to be
 * split three ways (a tenant token nobody used, shadcn's `primary`, and
 * `status-blue` doing duty as an accent on 965 elements), which is a
 * large part of why pages looked like they came from different products.
 *
 * Tailwind 3 can only apply opacity modifiers (`bg-primary/10`,
 * `border-primary/40`) to a CSS variable that holds bare RGB channels —
 * a hex string in the variable makes every modifier silently produce
 * nothing. So the brand is carried as channels.
 *
 * Two derived tones, so a tenant only has to pick one colour:
 *   dark  — hover/pressed state for solid brand buttons
 *   light — brand-coloured TEXT on the dark ink surfaces (top bar, photo
 *           hero). A deep brand colour as text on near-black fails
 *           contrast; the default crimson is 2.9:1 there. Same hue,
 *           fully saturated, lightness 71% — which is exactly the coral
 *           the home page already used on its hero eyebrow.
 */

export const DEFAULT_BRAND = "#ab2429";

export interface BrandTones {
  /** "171 36 41" — for rgb(var(--brand-rgb) / <alpha-value>). */
  rgb: string;
  darkRgb: string;
  lightRgb: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Only a plain 6-digit hex is accepted. The value ends up inside a
 *  <style> element, so anything else is refused rather than escaped. */
export function isBrandHex(value: string | null | undefined): value is string {
  return typeof value === "string" && HEX.test(value);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const k = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const hn = h / 360;
  return [k(hn + 1 / 3), k(hn), k(hn - 1 / 3)].map((v) =>
    Math.round(v * 255),
  ) as [number, number, number];
}

const channels = (rgb: [number, number, number]) => rgb.join(" ");

export function brandTones(hex: string): BrandTones {
  const base = hexToRgb(isBrandHex(hex) ? hex : DEFAULT_BRAND);
  const [h, s, l] = rgbToHsl(base);
  // Hover: 16% darker, clamped so a very dark brand still moves.
  const dark = hslToRgb([h, s, Math.max(0.12, l * 0.84)]);
  // On-ink text: a greyscale brand stays greyscale rather than being
  // saturated into an arbitrary hue.
  const light = hslToRgb([h, s < 0.08 ? 0 : 1, 0.71]);
  return { rgb: channels(base), darkRgb: channels(dark), lightRgb: channels(light) };
}
