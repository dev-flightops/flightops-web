/** Inline <style> that emits tenant-scoped CSS custom-property overrides.
 *
 *  Sits inside the authenticated (app) layout so every page inherits the
 *  same tenant palette without each route re-fetching. When both fields
 *  are null this renders nothing — the default tokens from globals.css
 *  win. When a color is set, we override `--brand-primary` (and the
 *  dark variant) with a hex string, which button/link/accent styles
 *  consume via `var(--brand-primary)`.
 *
 *  Placed in the tree so React SSRs it as static HTML; no client JS,
 *  no FOUC, no hydration overhead.
 */
export function BrandThemeStyle({
  primary,
  primaryDark,
}: {
  primary: string | null;
  primaryDark: string | null;
}) {
  const cleanPrimary = _sanitize(primary);
  const cleanPrimaryDark = _sanitize(primaryDark);
  if (!cleanPrimary && !cleanPrimaryDark) return null;

  // Fallback: if only one of the two is set, derive the other so hover /
  // active states stay coherent. Dark variant defaults to primary itself
  // if not provided; primary defaults to the dark variant.
  const p = cleanPrimary ?? cleanPrimaryDark;
  const pd = cleanPrimaryDark ?? cleanPrimary;

  return (
    <style>{`:root {
      --brand-primary: ${p};
      --brand-primary-dark: ${pd};
    }`}</style>
  );
}

/** Guard against anything that isn't a plain hex color. The server-side
 *  schema already validates this shape, but the frontend does one more
 *  pass so a bogus DB value can never become a CSS injection vector. */
function _sanitize(v: string | null): string | null {
  if (!v) return null;
  return /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(v) ? v : null;
}
