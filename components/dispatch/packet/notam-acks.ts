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
