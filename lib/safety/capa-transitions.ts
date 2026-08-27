import type { CapaStatus } from "@/lib/api/safety";

/**
 * The corrective-action lifecycle — the last leg of the SMS chain
 * (hazard → incident → corrective action → closure).
 *
 * Split out of StatusControls so it can be tested. This project runs
 * React 18 under vitest, which cannot render a component using
 * useActionState, so anything worth asserting has to live outside the
 * component — the same split KeyTable uses for the API-keys list.
 *
 * That constraint is doing a favour here: closure rules are the part an
 * auditor asks about, and they should not only be reachable through a
 * rendered form.
 */

/** Which statuses a finding may move to from where it is now. */
export const NEXT_STATUS_OPTIONS: Record<CapaStatus, readonly CapaStatus[]> = {
  // Straight to closed is allowed: plenty of findings are fixed on the
  // spot, and forcing a pointless trip through in_progress would only
  // teach people to click through it.
  open: ["in_progress", "closed"],
  // Deliberately no route back to open. Reopening is not a status flip —
  // it is a new finding — and offering it here would let someone undo
  // progress without leaving a reason behind.
  in_progress: ["closed"],
  // Terminal. A closed corrective action is a finished record.
  closed: [],
};

/** True when moving to `next` must carry a written closure reason. */
export function requiresClosureReason(next: CapaStatus): boolean {
  return next === "closed";
}

/** True when the finding is finished and offers no further transitions. */
export function isTerminal(status: CapaStatus): boolean {
  return NEXT_STATUS_OPTIONS[status].length === 0;
}

/**
 * The move a freshly-opened panel should default to.
 *
 * Falls back to the current status when there is nothing to move to,
 * which only happens on a terminal finding — the caller renders nothing
 * in that case, but the default has to be a real status either way.
 */
export function defaultNextStatus(current: CapaStatus): CapaStatus {
  return NEXT_STATUS_OPTIONS[current][0] ?? current;
}
