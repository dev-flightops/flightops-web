/**
 * Routing text helpers — shared between the Route input (dialog client
 * component) and the dispatch server component that reads from the
 * URL.
 *
 * The wire format in the URL is comma-separated: ?route=PADU,PAUN,PAGM.
 * The textarea format is one ICAO per line. Both ICAO and order are
 * preserved; duplicates are collapsed only when the backend fans out so
 * the dispatcher can keep the visual structure in the textarea.
 */

/** Parse free-text routing (multi-line or comma-separated) into a list of
 *  uppercase ICAO codes. Silently drops blank lines and tokens that don't
 *  look like ICAOs (3-4 alphanumerics). */
export function parseRouteText(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((t) => t.trim().toUpperCase())
    .filter((t) => /^[A-Z0-9]{3,4}$/.test(t));
}

/** Round-trip parseRouteText output to the URL search-param form. */
export function routeToParam(icaos: string[]): string {
  return icaos.join(",");
}

/** Parse a ?route= search param back into the canonical ICAO list. */
export function paramToRoute(param: string | null | undefined): string[] {
  if (!param) return [];
  return parseRouteText(param);
}
