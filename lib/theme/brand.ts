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
 *   light — brand-coloured TEXT, borders and focus rings on navy: the
 *           dark theme's page (#78), the top bar, a photo hero. A deep
 *           brand colour as text on navy fails contrast; the default
 *           crimson is 2.6:1 on a card. Same hue, fully saturated, made
 *           just light enough to clear MIN_CONTRAST_ON_DARK on every
 *           navy ground and on its own /10 and /15 tints over each — for
 *           the default, the coral the home page used on its hero eyebrow.
 */

import { contrastRatio } from "./contrast";

export const DEFAULT_BRAND = "#ab2429";

export interface BrandTones {
  /** "171 36 41" — for rgb(var(--brand-rgb) / <alpha-value>). */
  rgb: string;
  darkRgb: string;
  lightRgb: string;
  /** The accent as #rrggbb — the tenant's colour, or the legible
   *  version of it when it was too light (see MIN_CONTRAST_ON_WHITE). */
  hex: string;
  /** True when the tenant's colour had to be darkened to be legible. */
  adjusted: boolean;
}

/**
 * The accent carries white text (every primary button) and is itself
 * text on white (every link) and on its own /10 "selected" tint (active
 * nav items, the current lesson). A tenant can pick any colour; a light
 * one — a gold, a sky blue — would put ~1.7:1 white-on-gold buttons on
 * every page. 5.2:1 against white is what brand text needs to still
 * clear AA on that /10 tint, so below it the colour is darkened, keeping
 * its hue and saturation. Peregrine crimson is 7.0:1 and is untouched.
 */
export const MIN_CONTRAST_ON_WHITE = 5.2;

/** The navy grounds brand text sits on in the dark theme (#78): the card,
 *  the hover row and the top bar (app/globals.css). */
export const DARK_GROUNDS = ["#16212e", "#1c2938", "#23364d"] as const;

/** AA (4.5:1) with the same small margin MIN_CONTRAST_ON_WHITE keeps. */
export const MIN_CONTRAST_ON_DARK = 4.6;

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

const toHex = (rgb: [number, number, number]) =>
  "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");

/** The colour, darkened just enough to clear MIN_CONTRAST_ON_WHITE. */
function legible(rgb: [number, number, number]): {
  rgb: [number, number, number];
  adjusted: boolean;
} {
  if (contrastRatio("#ffffff", toHex(rgb)) >= MIN_CONTRAST_ON_WHITE) {
    return { rgb, adjusted: false };
  }
  const [h, s, l] = rgbToHsl(rgb);
  for (let lightness = l; lightness > 0; lightness -= 0.005) {
    const candidate = hslToRgb([h, s, lightness]);
    if (contrastRatio("#ffffff", toHex(candidate)) >= MIN_CONTRAST_ON_WHITE) {
      return { rgb: candidate, adjusted: true };
    }
  }
  return { rgb: [0, 0, 0], adjusted: true };
}

/** `fill` laid over `ground` at `alpha`, as a `bg-primary/10` tint is. */
function over(fill: [number, number, number], ground: string, alpha: number): string {
  const g = hexToRgb(ground);
  return toHex(fill.map((c, i) => Math.round(c * alpha + g[i] * (1 - alpha))) as [number, number, number]);
}

/** The brand made light enough to read on navy: its own hue, fully
 *  saturated (a greyscale brand stays grey), lightened from its own
 *  lightness until it clears MIN_CONTRAST_ON_DARK everywhere it is drawn. */
function onNavy(fill: [number, number, number]): [number, number, number] {
  const [h, s, l] = rgbToHsl(fill);
  const sat = s < 0.08 ? 0 : 1;
  // Every navy ground, and the brand's own tints over each: the top bar's
  // chips sit on a tint over the bar, the lightest of the grounds.
  const grounds = [...DARK_GROUNDS, ...DARK_GROUNDS.flatMap((g) => [over(fill, g, 0.1), over(fill, g, 0.15)])];
  for (let lightness = l; lightness <= 1; lightness += 0.005) {
    const candidate = hslToRgb([h, sat, lightness]);
    if (grounds.every((g) => contrastRatio(toHex(candidate), g) >= MIN_CONTRAST_ON_DARK)) {
      return candidate;
    }
  }
  return [255, 255, 255];
}

export function brandTones(hex: string): BrandTones {
  const { rgb: base, adjusted } = legible(
    hexToRgb(isBrandHex(hex) ? hex : DEFAULT_BRAND),
  );
  const [h, s, l] = rgbToHsl(base);
  // Hover: 16% darker, clamped so a very dark brand still moves.
  const dark = hslToRgb([h, s, Math.max(0.12, l * 0.84)]);
  // Text on navy (#78).
  const light = onNavy(base);
  return {
    rgb: channels(base),
    darkRgb: channels(dark),
    lightRgb: channels(light),
    hex: toHex(base),
    adjusted,
  };
}
