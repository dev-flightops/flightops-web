/**
 * Split a free-form ICAO list into an ordered, deduped, uppercase
 * array of 3-4 letter codes. Used by both the client `IcaoInputForm`
 * (to validate before navigation) and the server `/weather` page (to
 * read `?icaos=` from the URL). Lives outside the client component
 * so the server page can import it without crossing the "use client"
 * boundary.
 */
export function parseIcaos(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const cleaned = part.trim().toUpperCase();
    if (!/^[A-Z]{3,4}$/.test(cleaned)) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}
