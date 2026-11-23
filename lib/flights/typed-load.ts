import type { TypedPart } from "@/lib/api/manifest";

/**
 * Where the load a release is judged on comes from (#155, 1119-04): the
 * manifest, the numbers typed on the flight, or the manifest with the
 * typed number for a part it has none of yet. The client's TCL1 read
 * 0 lb the moment its manifest was started.
 */
export function loadSource(basis: string | undefined, typed: readonly TypedPart[] | undefined): string {
  if (basis !== "manifest") return "the passengers and cargo typed on the flight (no manifest yet; passengers at 190 lb)";
  const parts = typed ?? [];
  if (parts.length === 0) return "the manifest";
  const what =
    parts.length === 2 ? "passengers and cargo" : parts[0] === "passengers" ? "passengers" : "cargo";
  return `the manifest, with the ${what} typed on the flight until it has its own${
    parts.includes("passengers") ? " (passengers at 190 lb)" : ""
  }`;
}
