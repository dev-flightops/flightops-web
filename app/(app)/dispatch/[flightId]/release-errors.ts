/**
 * Pure helpers for mapping backend release errors to dispatcher-friendly
 * text. Kept in a separate file (no React, no `next/*` imports) so it
 * can be unit-tested under vitest without dragging in the next-auth →
 * next/server import chain.
 */

/** Pull the `blocking_issues[]` out of the structured 409 body returned
 *  by ops `/flights/{id}/release` when the aircraft fails the M2-M-8b
 *  airworthiness gate, and turn it into a short summary string for the
 *  inline release error. The Maintenance panel already renders the full
 *  list with formatting; this is just a one-line summary so the
 *  dispatcher sees the "why" right next to the Release button.
 *
 *  Returns null if the body isn't the expected structured shape — the
 *  caller falls back to a generic "see the Maintenance panel" message.
 */
export function extractBlockingSummary(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as {
      detail?: {
        error?: string;
        blocking_issues?: Array<{ description?: string }>;
      };
    };
    const issues = parsed.detail?.blocking_issues ?? [];
    const descriptions = issues
      .map((i) => i.description)
      .filter((s): s is string => Boolean(s));
    if (descriptions.length === 0) return null;
    // Cap at 2 + "(+N more)" so the inline error stays one line on
    // narrow screens.
    if (descriptions.length <= 2) return descriptions.join("; ");
    return `${descriptions.slice(0, 2).join("; ")} (+${descriptions.length - 2} more)`;
  } catch {
    return null;
  }
}

/** Pull `missing_icaos[]` out of the structured 409 the release endpoint
 *  returns when a routed stop has no NOTAM acknowledgment (audit finding
 *  C1), formatted for the inline error.
 *
 *  Naming the stops matters: the dispatcher's next action is to tick
 *  specific boxes, and "NOTAMs not acknowledged" without saying which
 *  airport sends them checking every one.
 *
 *  Returns null when the body isn't the expected shape, so the caller
 *  can fall back to generic text rather than rendering "undefined".
 */
export function extractMissingIcaos(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as {
      detail?: { error?: string; missing_icaos?: string[] };
    };
    const icaos = (parsed.detail?.missing_icaos ?? []).filter(
      (s): s is string => Boolean(s),
    );
    return icaos.length > 0 ? icaos.join(", ") : null;
  } catch {
    return null;
  }
}
