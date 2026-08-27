import type { HazardStatus } from "@/lib/api/safety";

/**
 * The hazard lifecycle — the first leg of the SMS chain
 * (hazard → incident → corrective action → closure).
 *
 * This map MIRRORS `_STATUS_TRANSITIONS` in
 * services/safety/app/routes/hazards.py. The backend is the authority:
 * it rejects a disallowed transition with a 400 regardless of what this
 * file says. Keeping a copy here is what lets the UI offer only the
 * moves that will actually be accepted, instead of showing a dropdown
 * option that always errors.
 *
 * Because it is a copy, it can drift. hazard-transitions.test.ts pins it
 * against a written-out copy of the backend map so drift fails a test
 * rather than shipping a dead menu item.
 *
 * Split out of TriageControls so it can be tested at all: this project
 * runs React 18 under vitest, which cannot render a component using
 * useActionState.
 */
export const NEXT_STATUS_OPTIONS: Record<
  HazardStatus,
  readonly HazardStatus[]
> = {
  submitted: ["triaged", "closed"],
  triaged: ["in_progress", "closed"],
  in_progress: ["closed"],
  closed: [],
};

/** True when the hazard is finished and offers no further transitions. */
export function isTerminal(status: HazardStatus): boolean {
  return NEXT_STATUS_OPTIONS[status].length === 0;
}

/** The move a freshly-opened triage panel should default to. */
export function defaultNextStatus(current: HazardStatus): HazardStatus {
  return NEXT_STATUS_OPTIONS[current][0] ?? current;
}
