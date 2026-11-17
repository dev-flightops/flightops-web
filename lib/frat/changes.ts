import type { FratChanges, FratFactorChange } from "@/lib/api/types";

import { FACTOR_GROUPS, factorLabel } from "./factors";

/**
 * What a FRAT changed since the other side last saw it, in words (17 Nov).
 * The client: "If they do change the frat, the dispatcher should be alerted
 * to those changes and then require signing again after the changes have
 * been acknowledged." The packet, the FRAT page, the preflight and the
 * hand-offs all say it the same way: "Pilot rest: 1 → 3".
 */

const ORDER = new Map(FACTOR_GROUPS.flatMap((g) => g.factors).map((f, i) => [f.code, i]));

/** The questionnaire's order; factors it no longer asks come last. */
function byQuestionnaire(a: FratFactorChange, b: FratFactorChange): number {
  return (ORDER.get(a.code) ?? ORDER.size) - (ORDER.get(b.code) ?? ORDER.size) || a.code.localeCompare(b.code);
}

function score(value: number | null): string {
  return value === null ? "—" : String(value);
}

/** "Pilot rest: 1 → 3". A dash where a version doesn't have the factor. */
export function factorChangeLine(change: FratFactorChange): string {
  return `${factorLabel(change.code)}: ${score(change.before)} → ${score(change.after)}`;
}

/** Each change on its own line, the factors in the questionnaire's order,
 *  then the mitigation. */
export function changeLines(changes: Pick<FratChanges, "factors" | "mitigations_before" | "mitigations_after">): string[] {
  const lines = [...changes.factors].sort(byQuestionnaire).map(factorChangeLine);
  const before = changes.mitigations_before;
  const after = changes.mitigations_after;
  if (before !== after) {
    lines.push(
      before === null
        ? `Mitigation added: “${after}”`
        : after === null
          ? `Mitigation removed (was “${before}”)`
          : `Mitigation: “${before}” → “${after}”`,
    );
  }
  return lines;
}

/** One line for a hand-off: "Pilot rest 1 → 3, Surface wind 0 → 2 and 1
 *  more, and the mitigation". */
export function changeSummary(
  factors: FratFactorChange[] | undefined,
  mitigationsChanged: boolean | undefined,
  shown = 3,
): string {
  const sorted = [...(factors ?? [])].sort(byQuestionnaire);
  const named = sorted
    .slice(0, shown)
    .map((c) => `${factorLabel(c.code)} ${score(c.before)} → ${score(c.after)}`);
  const rest = sorted.length - named.length;
  const scores = named.length === 0 ? "" : `${named.join(", ")}${rest > 0 ? ` and ${rest} more` : ""}`;
  if (mitigationsChanged) return scores ? `${scores}, and the mitigation` : "the mitigation";
  return scores || "no score changed";
}
