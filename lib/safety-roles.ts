import { roleGate } from "@/lib/roles";

/**
 * Who may act on safety records. One definition, shared by the list
 * pages and the detail pages.
 *
 * WHY THIS FILE EXISTS
 *
 * These three gates were written out six times — once in each list page
 * and once in each detail page. flightops-services PR #187 ("Admit the
 * post-holder roles to the API gates behind their pages") widened the
 * API to let a Director of Operations triage reports and read the CAPA
 * board. The three LIST pages were updated to match. The three DETAIL
 * pages were not.
 *
 * The result was worse than a missing capability. A DO could open the
 * hazard list and the CAPA board, see them as a triager, click into a
 * report — and find the triage controls gone, on a record the API would
 * have accepted their triage for.
 *
 * It was missed because the list pages used the typed `roleGate()` and
 * the detail pages used bare `new Set(["safety_officer", ...])`. A
 * sweep for `roleGate` found three of six. That is the exact failure
 * `lib/roles.ts` was written to stop, so these now go through it too.
 *
 * Mirrors, exactly:
 *   TRIAGE -> services/safety/app/routes/hazards.py     TRIAGE_ROLES
 *             services/safety/app/routes/incidents.py   TRIAGE_ROLES
 *   BOARD  -> services/safety/app/routes/corrective_actions.py BOARD_ROLES
 *   MANAGE -> services/safety/app/routes/corrective_actions.py MANAGE_ROLES
 *
 * These decide whether a CONTROL IS RENDERED. The API is the security
 * boundary and re-checks every call. Too generous renders a button that
 * 403s; too stingy hides a capability somebody holds. Both are bugs,
 * which is why they have to match and why the test pins them.
 */

/** Triage a hazard or incident: severity, likelihood, status. */
export const TRIAGE_ROLES = roleGate(
  "safety_officer",
  "chief_pilot",
  "director_of_operations",
  "exec_admin",
);

/** Read the CAPA board — every corrective action in the tenant. */
export const BOARD_ROLES = roleGate(
  "safety_officer",
  "chief_pilot",
  "director_of_operations",
  "exec_admin",
);

/**
 * Open, reassign or close a CAPA. Narrower than BOARD on purpose: a
 * chief pilot or DO can read the board and triage the report behind a
 * CAPA, but owning the corrective-action programme is the Safety
 * Officer's. Matches the API — not an oversight.
 */
export const MANAGE_ROLES = roleGate("safety_officer", "exec_admin");
