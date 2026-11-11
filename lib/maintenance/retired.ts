import { outOfService } from "./out-of-service";

/**
 * A retired aircraft's open items, kept apart from the fleet's (audit
 * 1110-16, 10 Nov: N301PA, N402PA and N705PA were retired with open MEL
 * items and squawks, which read as work the fleet was waiting on).
 *
 * They weren't retired: two were grounded by MEL items past due, one by
 * hand (lib/maintenance/out-of-service.ts). A retired aircraft's items stay
 * on file, so its records are whole if it comes back; nothing flies it. The cross-fleet lists show
 * them in a section of their own, closed at first. Filtered to one
 * aircraft, a list shows that aircraft's items as they are.
 */
export function splitRetired<T extends { aircraft: { id: string } }>(
  items: T[],
  fleet: readonly { id: string; tail_number: string; is_active: boolean; grounded_reason?: string | null }[],
  aircraftId: string | null,
): { current: T[]; retired: T[]; tails: string[] } {
  if (aircraftId) return { current: items, retired: [], tails: [] };
  // Retired only: a grounded aircraft is out of the fleet too, but its open
  // items are what grounds it, the work that brings it back.
  const retired = new Map(fleet.filter((a) => outOfService(a) === "retired").map((a) => [a.id, a.tail_number]));
  const onRetired = items.filter((i) => retired.has(i.aircraft.id));
  return {
    current: items.filter((i) => !retired.has(i.aircraft.id)),
    retired: onRetired,
    tails: [...new Set(onRetired.map((i) => retired.get(i.aircraft.id)!))].sort(),
  };
}
