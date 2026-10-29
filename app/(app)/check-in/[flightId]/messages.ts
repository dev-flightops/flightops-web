/**
 * Check-in refusals in words (#103). Pure, so the wording is tested
 * without the server-action chain.
 */

const BY_CODE: Record<string, string> = {
  manifest_locked: "The manifest is locked, so nothing more can change.",
  boarding_closed: "Boarding has closed.",
  boarding_not_open: "Begin boarding first.",
  not_checked_in: "Check them in before boarding them.",
  already_boarded: "They're already on board.",
  marked_no_show: "They're marked as a no-show. Undo that first.",
  not_standby: "They aren't on the standby list.",
  crew_not_checked_in: "Crew aren't checked in.",
  manifest_not_created: "This flight has no manifest yet.",
  pax_not_found: "That passenger isn't on the manifest any more. Reload the page.",
  flight_not_found: "That flight isn't there any more. Reload the page.",
};

type Detail =
  | string
  | {
      error?: string;
      missing?: string[];
      passengers?: string[];
      field?: string;
      over_by_lbs?: number;
      useful_load_lbs?: number;
    }
  | null;

/** The `detail` of a FastAPI error body, or null when it has none. */
export function detailOf(body: string): Detail {
  try {
    const parsed = JSON.parse(body) as { detail?: Detail };
    return parsed.detail ?? null;
  } catch {
    return null;
  }
}

/** A refusal's message, or null when it isn't one of the check-in's. */
export function refusalMessage(body: string): string | null {
  const detail = detailOf(body);
  if (typeof detail === "string") return BY_CODE[detail] ?? null;
  if (!detail) return null;
  switch (detail.error) {
    case "check_in_incomplete":
      return `Still needed: ${(detail.missing ?? []).join(", ")}.`;
    case "passengers_unresolved":
      return `Check these passengers in, or mark them as no-shows, before closing boarding: ${(detail.passengers ?? []).join(", ")}.`;
    case "not_an_option":
      return `${detail.field}: pick one of the options.`;
    case "not_a_number":
      return `${detail.field} has to be a number.`;
    case "over_weight":
      return `${(detail.over_by_lbs ?? 0).toLocaleString("en-US")} lb over the aircraft's useful load of ${(detail.useful_load_lbs ?? 0).toLocaleString("en-US")} lb. Offload bags or freight, or move a passenger, before boarding.`;
    default:
      return null;
  }
}
