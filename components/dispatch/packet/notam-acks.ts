/**
 * Server-safe helpers for the NOTAM acknowledgment panel.
 *
 * The panel itself is a client component (`"use client"` for checkbox
 * state + router navigation). Server components can't import anything
 * from a client module — even pure-function helpers — so parsing the
 * `?notams_acked=` query param lives here instead, where both the
 * server-rendered dispatch page and the client panel can pull it in.
 */

/** Parse the `?notams_acked=PANC,PABE` query value into an array of
 *  uppercase ICAOs. Empty / missing → []. Whitespace + duplicates
 *  collapsed. */
export function parseAckedIcaos(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

/**
 * Which routed ICAOs still lack a NOTAM acknowledgment.
 *
 * The single source of truth for the release gate: the NOTAM panel
 * promises "all boxes must be checked before Generate PDF unlocks," and
 * the dispatch page blocks release when this returns a non-empty list.
 * Matching is case-insensitive, and an ack only counts if the ICAO is
 * still in the current route (mirrors the panel filtering a removed
 * stop's ack). Empty route → [] (nothing to acknowledge, no block).
 */
export function unacknowledgedNotamIcaos(
  icaos: string[],
  ackedFromUrl: string[],
): string[] {
  if (icaos.length === 0) return [];
  const route = icaos.map((s) => s.trim().toUpperCase());
  const acked = new Set(
    ackedFromUrl
      .map((s) => s.trim().toUpperCase())
      .filter((s) => route.includes(s)),
  );
  return route.filter((i) => !acked.has(i));
}
