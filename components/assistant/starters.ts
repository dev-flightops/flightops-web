import type { Role } from "@/lib/roles";

/**
 * The questions Peregrine Assistant suggests before the first one (#114),
 * by what the person does: a dispatcher's day and a pilot's are different
 * days. The first role that matches decides, in this order, so a Chief
 * Pilot who also flies gets a pilot's questions.
 *
 * Each is answered by the help content: a guide, an FAQ answer or a page
 * article (lib/help/), so a suggestion never leads to "the help doesn't
 * cover that".
 */

const BY_ROLE: ReadonlyArray<readonly [readonly Role[], readonly string[]]> = [
  [
    ["dispatcher"],
    [
      "How do I release a flight?",
      "Why won't my flight release?",
      "How do I build a round trip?",
      "What does below dispatch minimums mean?",
    ],
  ],
  [
    ["pilot", "crew_member", "check_airman", "chief_pilot"],
    [
      "How do I file a FRAT?",
      "How do I write up a squawk?",
      "How do I complete my flight log?",
      "What do the FRAT levels mean?",
    ],
  ],
  [
    ["ground_ops", "reservations_agent"],
    [
      "How do I check passengers in at the gate?",
      "Why can't I add another passenger?",
      "How do I load waiting mail and freight?",
      "How does a trip go from booking to invoice?",
    ],
  ],
  [
    ["maintenance", "director_of_maintenance"],
    [
      "How do I write up a squawk?",
      "What makes an aircraft not airworthy?",
      "How does a squawk stop a release?",
      "How do I return an aircraft to service?",
    ],
  ],
];

const EVERYONE = [
  "How does a trip go from booking to invoice?",
  "Why won't my flight release?",
  "How do I raise and send invoices?",
  "What do the FRAT levels mean?",
];

/** Asked first on a page showing a setup or failed-load notice (#138):
 *  the question goes with those notices, so it's answered from them. */
export const WHY_NOT_HERE = "Why can't I go ahead here?";

export function startersFor(roles: readonly string[], noticesShown = false): readonly string[] {
  const questions = forRoles(roles);
  return noticesShown ? [WHY_NOT_HERE, ...questions.slice(0, 3)] : questions;
}

function forRoles(roles: readonly string[]): readonly string[] {
  for (const [match, questions] of BY_ROLE) {
    if (roles.some((role) => (match as readonly string[]).includes(role))) return questions;
  }
  return EVERYONE;
}
