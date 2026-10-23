import type { AircraftListItem } from "@/lib/api/types";

export interface FleetType {
  /** The fleet's type slug, as aircraft carry it ("navajo"). */
  slug: string;
  /** What the fleet calls it: the models flying under the slug. */
  label: string;
}

/** The fleet's aircraft types, as release judges them (#87, #89): each
 *  slug once, labelled with the models that fly under it. */
export function fleetTypes(aircraft: AircraftListItem[]): FleetType[] {
  const models = new Map<string, Set<string>>();
  for (const a of aircraft) {
    const slug = (a.airframe_type ?? "").trim().toLowerCase();
    if (!slug) continue;
    const set = models.get(slug) ?? new Set<string>();
    if (a.model) set.add(a.model);
    models.set(slug, set);
  }
  return [...models.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, set]) => ({ slug, label: [...set].sort().join(", ") }));
}
