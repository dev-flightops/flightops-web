import type { ReactNode, SVGProps } from "react";

/**
 * The app's own glyphs (#79), in place of a stock icon set: a few strokes
 * each, on one 16-unit grid at one weight, so they read as one family.
 *
 * The client's brief rules out generic icon sets, and ForeFlight says most
 * things in words. So a glyph is used only where it carries meaning a word
 * would not — close, refresh, the direction of a chevron, a warning — and
 * a control that holds one still names itself (`aria-label` or text).
 * Every glyph is decorative to assistive technology (`aria-hidden`).
 */
export type GlyphProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  /** Rendered size in px; the drawing scales from its 16-unit grid. */
  size?: number;
};

function Glyph({ size = 16, children, ...rest }: GlyphProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function CloseGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </Glyph>
  );
}

export function CheckGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M3 8.5l3 3 7-7" />
    </Glyph>
  );
}

export function ChevronRightGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M6 3.5l4.5 4.5L6 12.5" />
    </Glyph>
  );
}

export function ChevronDownGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M3.5 6l4.5 4.5L12.5 6" />
    </Glyph>
  );
}

export function PlusGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M8 3v10M3 8h10" />
    </Glyph>
  );
}

export function RefreshGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M13 8a5 5 0 1 1-1.47-3.54" />
      <path d="M13 2.5V5.5H10" />
    </Glyph>
  );
}

export function DownloadGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M8 2.5v7.5M4.5 6.5L8 10l3.5-3.5M3 13.5h10" />
    </Glyph>
  );
}

/** A warning: the triangle with its mark. One glyph for every severity —
 *  the colour around it says how bad. */
export function AlertGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M8 2.5l6 11H2z" strokeLinejoin="round" />
      <path d="M8 6.5v3M8 11.25v.5" />
    </Glyph>
  );
}

export function InfoGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.25v4M8 4.75v.5" />
    </Glyph>
  );
}

export function ClockGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.75V8l2.25 1.5" />
    </Glyph>
  );
}

export function EditGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M10.5 3l2.5 2.5L6 12.5H3.5V10z" />
    </Glyph>
  );
}

export function SendGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M2.5 7.5l11-5-5 11-1.5-4.5z" strokeLinejoin="round" />
    </Glyph>
  );
}

export function SignInGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M9.5 3H13v10H9.5M2.5 8h7M7 5.5L9.5 8 7 10.5" />
    </Glyph>
  );
}

export function SignOutGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M6.5 3H3v10h3.5M6 8h7.5M11 5.5L13.5 8 11 10.5" />
    </Glyph>
  );
}

export function SearchGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5l3 3" />
    </Glyph>
  );
}

export function ExternalGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M9 3h4v4M13 3L7.5 8.5M11 9.5V13H3V5h3.5" />
    </Glyph>
  );
}

/** The loading mark: a three-quarter ring, spun by the caller's
 *  `animate-spin` (Spinner does it). */
export function SpinnerGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M8 2.5a5.5 5.5 0 1 1-5.5 5.5" strokeLinecap="round" />
    </Glyph>
  );
}
