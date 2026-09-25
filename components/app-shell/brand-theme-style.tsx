import { brandTones, isBrandHex } from "@/lib/theme/brand";

/** Inline <style> that emits the tenant's brand as theme variables.
 *
 *  The brand is the theme's single accent — primary buttons, links,
 *  focus rings, active tabs — so a tenant that sets one colour in
 *  Settings → Branding gets the whole app in it, not just a handful of
 *  buttons. With nothing set this renders nothing and the Peregrine
 *  crimson in globals.css wins.
 *
 *  Emits bare RGB channels (`--brand-rgb: 171 36 41`) because that is
 *  the only form Tailwind 3 can put an opacity modifier on; the hex
 *  variables stay for the few inline `var(--brand-primary)` consumers.
 *
 *  Server-rendered as static HTML: no client JS, no flash of the default.
 */
export function BrandThemeStyle({
  primary,
  primaryDark,
}: {
  primary: string | null;
  primaryDark: string | null;
}) {
  const p = isBrandHex(primary) ? primary : isBrandHex(primaryDark) ? primaryDark : null;
  if (!p) return null;

  // brandTones darkens a colour too light to carry white text, so every
  // value below is the legible version of what the tenant picked.
  const tones = brandTones(p);
  // A tenant who picked their own hover shade keeps it; otherwise it is
  // derived from the brand so the pair stays coherent.
  const hover = isBrandHex(primaryDark) ? brandTones(primaryDark) : null;
  const hoverRgb = hover ? hover.rgb : tones.darkRgb;

  return (
    // Every island re-declares its palette, so each needs the tenant's
    // brand re-applied — or a panel opened from the dark top bar (a
    // `.light` island) would show Peregrine crimson to another tenant.
    <style>{`:root, .dark, .light {
      --brand-rgb: ${tones.rgb};
      --brand-dark-rgb: ${hoverRgb};
      --brand-light-rgb: ${tones.lightRgb};
      --brand-primary: ${tones.hex};
      --brand-primary-dark: ${hover?.hex ?? tones.hex};
    }`}</style>
  );
}
