import type {
  MinimumsObservation,
  MinimumsStation,
  WeatherMinimumsView,
} from "@/lib/api/types";

/**
 * The company's dispatch minimums in words (#89).
 *
 * The client's GOM: "For dispatchable flight we need a minimum of 600 ft
 * ceilings and 2 sm of visibility for VFR flight in IFR conditions", and
 * an aircraft that is not IFR certified must not be dispatched below
 * them at the departure or the destination. Release refuses it
 * (409 `below_weather_minimums`); the dispatch packet says so first, and
 * Open New Flight after creating one. One wording for all three.
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

/** Why the packet's Release is held, or null when it isn't (#89). */
export function minimumsBlockReason(view: WeatherMinimumsView | null | undefined): string | null {
  if (!view?.applies || !view.below) return null;
  return (
    `Below the company's dispatch minimums for aircraft not IFR certified ` +
    `(${minimumsLabel(view.min_ceiling_ft, view.min_visibility_sm)}): ` +
    `${belowSummary(view.stations)}. No release until it comes up, or move the ` +
    `flight to an IFR-certified aircraft.`
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
