import type {
  MinimumsObservation,
  MinimumsStation,
  WeatherMinimumsView,
} from "@/lib/api/types";

/**
 * The company's dispatch minimums in words (#89, #110).
 *
 * The client's GOM: "For dispatchable flight we need a minimum of 600 ft
 * ceilings and 2 sm of visibility for VFR flight in IFR conditions", and
 * an aircraft that is not IFR certified must not be dispatched below
 * them at the departure or the destination. Nor may any aircraft at a
 * field without an instrument approach, which is reached VFR (#110).
 * Since #123 that holds every flight flown VFR, whatever the aircraft.
 * Release refuses it (409 `below_weather_minimums`); the dispatch packet
 * says so first, and Open New Flight after creating one. One wording for
 * all three.
 */

/** "600 ft / 2 sm". */
export function minimumsLabel(
  ceilingFt: number | null | undefined,
  visibilitySm: number | string | null | undefined,
): string {
  return `${Number(ceilingFt ?? 0).toLocaleString("en-US")} ft / ${Number(visibilitySm ?? 0)} sm`;
}

function observationText(o: MinimumsObservation): string {
  const parts: string[] = [];
  if (o.below_ceiling && o.ceiling_ft != null) {
    parts.push(`ceiling ${o.ceiling_ft.toLocaleString("en-US")} ft`);
  }
  if (o.below_visibility && o.visibility_sm != null) {
    parts.push(`visibility ${o.visibility_sm} sm`);
  }
  const text = parts.join(", ");
  return o.source === "field_report" ? `${text} (village report)` : text;
}

/** "PAEM ceiling 500 ft, visibility 1.5 sm; PABE ceiling 400 ft
 *  (village report)": the stops that are below, and what is. */
export function belowSummary(stations: MinimumsStation[]): string {
  return stations
    .filter((s) => s.below)
    .map((s) => {
      const what = s.observations.filter((o) => o.below_ceiling || o.below_visibility);
      return `${s.icao} ${what.map(observationText).join("; ")}`;
    })
    .join("; ");
}

/** True when the stops are held for the aircraft's type, not for want of
 *  an instrument approach (#110). A stop from before #110 says no reason,
 *  and was held for the type. */
export function heldForType(stations: MinimumsStation[]): boolean {
  return stations.every((s) => (s.reason ?? "not_ifr_certified") === "not_ifr_certified");
}

/** True when the stops are held because the flight is flown VFR (#123). */
export function heldForVfr(stations: MinimumsStation[]): boolean {
  return stations.some((s) => s.reason === "vfr_flight");
}

/** "PAEM" or "PAEM and PAII": the stops held for want of an approach. */
export function withoutApproach(stations: MinimumsStation[]): string {
  const icaos = stations.filter((s) => s.reason === "no_instrument_approach").map((s) => s.icao);
  return icaos.length > 1
    ? `${icaos.slice(0, -1).join(", ")} and ${icaos[icaos.length - 1]}`
    : (icaos[0] ?? "");
}

/** Why the packet's Release is held, or null when it isn't (#89, #110). */
export function minimumsBlockReason(view: WeatherMinimumsView | null | undefined): string | null {
  if (!view?.applies || !view.below) return null;
  const label = minimumsLabel(view.min_ceiling_ft, view.min_visibility_sm);
  if (heldForType(view.stations)) {
    return (
      `Below the company's dispatch minimums for aircraft not IFR certified ` +
      `(${label}): ${belowSummary(view.stations)}. No release until it comes up, or move the ` +
      `flight to an IFR-certified aircraft.`
    );
  }
  if (heldForVfr(view.stations)) {
    return (
      `Below the company's dispatch minimums for a VFR flight (${label}): ` +
      `${belowSummary(view.stations)}. No release until it comes up. If the flight will be flown ` +
      `IFR, tick Flown IFR under Edit.`
    );
  }
  const below = view.stations.filter((s) => s.below);
  return (
    `Below the company's dispatch minimums (${label}) at a field without an instrument ` +
    `approach: ${belowSummary(view.stations)}. ${withoutApproach(below)} can only be reached ` +
    `VFR, whatever the aircraft: no release until the weather there comes up.`
  );
}

/** The same, from release's 409 body. Null when the body isn't that shape. */
export function belowMinimumsFromError(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as {
      detail?: {
        error?: string;
        min_ceiling_ft?: number;
        min_visibility_sm?: number;
        stations?: MinimumsStation[];
      };
    };
    const detail = parsed.detail;
    if (detail?.error !== "below_weather_minimums" || !detail.stations?.length) return null;
    return minimumsBlockReason({
      applies: true,
      below: true,
      airframe_type: null,
      min_ceiling_ft: detail.min_ceiling_ft ?? null,
      min_visibility_sm: detail.min_visibility_sm ?? null,
      stations: detail.stations,
    });
  } catch {
    return null;
  }
}
