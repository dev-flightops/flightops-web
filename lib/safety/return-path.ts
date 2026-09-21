/**
 * Where the global red Safety button sends a reporter back to.
 *
 * The button carries the page it was pressed on as `?return_url=`, the
 * same way legacy's FAB does (`base.html`:
 * `/safety/reports/new?return_url={{ request.url.path | urlencode }}`),
 * so filing a hazard doesn't cost the reporter their place.
 *
 * The value is attacker-suppliable — anyone can send a colleague a
 * /safety/report link with any `return_url` on it — and it is rendered
 * into an `href`. So it is treated as untrusted: only a same-origin
 * absolute path survives. Everything else falls back to the Safety SMS
 * hub, which is a worse back link and a safe one.
 */
export function safeReturnPath(raw: string | undefined | null): string | null {
  if (!raw) return null;
  // Must be an absolute path on this origin. Rejects `javascript:`,
  // `data:`, and `https://evil.test` by requiring the leading slash...
  if (!raw.startsWith("/")) return null;
  // ...and rejects `//evil.test/x`, which is protocol-relative: a
  // browser reads it as a different host despite the leading slash.
  if (raw.startsWith("//")) return null;
  // `/\evil.test` is treated as protocol-relative by some browsers.
  if (raw.startsWith("/\\")) return null;
  return raw;
}
