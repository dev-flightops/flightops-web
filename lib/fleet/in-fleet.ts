/**
 * In the fleet: active, or grounded (#157). Grounding clears `is_active`,
 * so counting active aircraft dropped exactly the ones on the ground: the
 * executive dashboard read "5/5 fleet airworthy, 0 on hold" with three
 * grounded. A retired aircraft is inactive with no grounding, and is the
 * only one left out.
 */
export function inFleet(row: { is_active: boolean; grounded_at?: string | null }): boolean {
  return row.is_active || Boolean(row.grounded_at);
}
