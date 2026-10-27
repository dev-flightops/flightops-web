import type { ManifestLoad } from "@/lib/api/manifest";

/** "Pat Pilot" or "Pat Pilot and Sam Second". */
function names(list: string[]): string {
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : (list[0] ?? "");
}

/**
 * How the load counted the crew, in words (#74, #125): as weighed on the
 * manifest, or the assigned crew at the weights on their records, naming
 * anyone counted at the standard weight because none is on file.
 */
export function crewWeightNote(
  load: Pick<ManifestLoad, "crew_basis" | "crew_count" | "crew_estimated_for">,
): string {
  if (load.crew_basis === "manifest") return "as weighed on the manifest";
  if (load.crew_basis === "none") return "no crew on the flight yet";
  const assigned = `${load.crew_count} assigned`;
  // A service from before #125 says nothing of the records.
  if (load.crew_estimated_for == null) return `${assigned}, at standard weight`;
  if (load.crew_estimated_for.length === 0) return `${assigned}, at the weights on their records`;
  return `${assigned}; the standard weight for ${names(load.crew_estimated_for)}, with no weight on file`;
}
