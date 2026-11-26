/**
 * Response headers every page carries (code audit, 26 Nov). www sent only
 * Vercel's HSTS, so another site could put the app in a frame and trick a
 * click on Release or Sign, and the browser had no other backstop.
 *
 * - Framing: the app's own pages only. Not DENY: the Academy's SCORM
 *   player frames lessons the app serves itself, and FlightOps has no
 *   widget other sites embed (lib/legacy-redirects.ts).
 * - Permissions: the app asks for no camera, microphone, location or
 *   payment API. A ramp photo is a file input with `capture`, which needs
 *   no permission.
 * - HSTS stays Vercel's: includeSubDomains would bind every subdomain of
 *   the domain, which this app can't vouch for.
 */
export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];
