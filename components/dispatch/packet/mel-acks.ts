/**
 * Server-safe helpers for the MEL acknowledgment panel (Spec 7).
 *
 * Mirrors the NOTAM-ack pattern: open MEL ids the dispatcher has
 * acknowledged live in the URL as `?mels_acked=id1,id2`. The panel is
 * a client component (checkbox state + router navigation); this
 * module is the pure-function parser that both the server-rendered
 * dispatch page and the client panel can share.
 */

/** Parse the `?mels_acked=mel_id_1,mel_id_2` query value into an
 *  array of MEL ids. Empty / missing → []. Whitespace + duplicates
 *  collapsed. */
export function parseAckedMelIds(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** Serialize a set of MEL ids back to the query-param form. Stable
 *  alphabetical ordering so toggling acks doesn't churn the URL. */
export function serializeAckedMelIds(ids: Iterable<string>): string {
  return [...new Set(ids)].sort().join(",");
}
