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

  const tones = brandTones(p);
  // A tenant who picked their own hover shade keeps it; otherwise it is
  // derived from the brand so the pair stays coherent.
  const hoverHex = isBrandHex(primaryDark) ? primaryDark : null;
  const hoverRgb = hoverHex ? brandTones(hoverHex).rgb : tones.darkRgb;

  return (
    <style>{`:root, .dark {
      --brand-rgb: ${tones.rgb};
      --brand-dark-rgb: ${hoverRgb};
      --brand-light-rgb: ${tones.lightRgb};
      --brand-primary: ${p};
      --brand-primary-dark: ${hoverHex ?? p};
    }`}</style>
  );
}
