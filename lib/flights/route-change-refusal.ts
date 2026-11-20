import type { ApiError } from "@/lib/api/client";

/** "A", "A and B", "A, B and C". */
export function namesList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

interface Refusal {
  error?: unknown;
  stops?: unknown;
  passengers?: unknown;
  lines?: unknown;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : [];

/**
 * Why an edit that takes stops off the route was refused (#208), or null
 * for any other refusal. Ops refuses it, changing nothing, when a booking
 * going back to Awaiting a flight has a passenger checked in (the gate
 * undoes that first), or when something would come off a locked manifest.
 */
export function routeChangeRefusal(err: Pick<ApiError, "status" | "message">): string | null {
  if (err.status !== 409) return null;
  let detail: Refusal;
  try {
    detail = (JSON.parse(err.message) as { detail?: Refusal }).detail ?? {};
  } catch {
    return null;
  }
  if (typeof detail !== "object" || detail === null) return null;
  const stops = strings(detail.stops);
  const off = stops.length ? namesList(stops) : null;
  if (detail.error === "passengers_checked_in") {
    const names = strings(detail.passengers);
    if (!names.length) return null;
    const are = names.length === 1 ? "is" : "are";
    return (
      `${namesList(names)} ${are} checked in${off ? ` for ${off}` : ""}. ` +
      "Undo the check-in on the Check-in page first, then save the route."
    );
  }
  if (detail.error === "manifest_locked") {
    const what = [...strings(detail.passengers), ...strings(detail.lines)];
    const gone = off ? ` (${off} ${stops.length === 1 ? "is no longer a stop" : "are no longer stops"})` : "";
    return (
      `The manifest is locked, and this route takes ${what.length ? namesList(what) : "passengers or freight"} off it` +
      `${gone}. Reopen the manifest, then save the route.`
    );
  }
  return null;
}
