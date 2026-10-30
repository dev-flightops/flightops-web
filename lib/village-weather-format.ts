import type { FlightCategory, VillageWeatherReportResponse } from "@/lib/api/types";

/**
 * How a village observer's report reads: on the Village Weather Board,
 * and under each stop's METAR on the dispatch packet (#110).
 */

/** Yellow past two hours (the release's stale-weather threshold), red past four. */
export const VILLAGE_STALE_YELLOW_MS = 2 * 60 * 60 * 1000;
export const VILLAGE_STALE_RED_MS = 4 * 60 * 60 * 1000;

export function villageSky(r: VillageWeatherReportResponse): string | null {
  const cloud = r.cloud_cover;
  // Legacy peregrineflight renders ceiling as a bare number ("1000ft"),
  // not the US-locale-grouped "1,000ft". Pilots scan ceilings at a
  // glance — the comma adds visual noise without aiding readability
  // at the typical 200–10,000 ft range.
  const ceiling = r.ceiling_ft != null ? `${r.ceiling_ft}ft` : null;
  const vis = r.visibility_sm != null ? villageVisibility(r.visibility_sm) : null;

  const left = [cloud, ceiling].filter(Boolean).join(" ");
  const right = vis ? `Vis ${vis}` : null;
  const combined = [left || null, right].filter(Boolean).join(" · ");
  return combined || null;
}

export function villageVisibility(sm: number): string {
  if (sm < 0.25) return "< 1/4SM";
  if (sm < 1) {
    // Render as a fraction the dispatcher recognizes.
    const frac = Math.round(sm * 4) / 4;
    if (frac === 0.25) return "1/4SM";
    if (frac === 0.5) return "1/2SM";
    if (frac === 0.75) return "3/4SM";
  }
  return `${sm}SM`;
}

export function villageWind(r: VillageWeatherReportResponse): string | null {
  if (r.wind_speed_kt == null && r.wind_dir_deg == null) return null;
  if (r.wind_speed_kt === 0) return "Calm";
  const dir =
    r.wind_dir_deg != null
      ? String(r.wind_dir_deg).padStart(3, "0") + "°"
      : "VRB";
  const speed = r.wind_speed_kt != null ? `${r.wind_speed_kt}kt` : "";
  const gust = r.wind_gust_kt ? `G${r.wind_gust_kt}` : "";
  return `Wind ${dir}/${speed}${gust}`;
}

export function villageAge(ms: number): string {
  if (ms < 60_000) return "<1m";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  const days = hours / 24;
  return `${days.toFixed(days < 10 ? 1 : 0)}d`;
}

export function villageStaleness(reportedAtMs: number, nowMs: number): "yellow" | "red" | null {
  const age = nowMs - reportedAtMs;
  if (age > VILLAGE_STALE_RED_MS) return "red";
  if (age > VILLAGE_STALE_YELLOW_MS) return "yellow";
  return null;
}

/** The covers that make a ceiling (14 CFR 1.1): broken, overcast, an
 *  obscured sky. A base reported with no cover is taken as one, as the
 *  weather service does (flightops_shared.flight_category). */
const CEILING_COVERS = new Set(["BKN", "OVC", "VV"]);

/** The FAA's flight category for a ceiling and a visibility, by the
 *  service's own bands: 3,000 ft and 5 SM are MVFR. */
function band(ceilingFt: number | null, visibilitySm: number | null): FlightCategory {
  const ceiling = ceilingFt ?? Infinity;
  const visibility = visibilitySm ?? Infinity;
  if (ceiling < 500 || visibility < 1) return "LIFR";
  if (ceiling < 1000 || visibility < 3) return "IFR";
  if (ceiling <= 3000 || visibility <= 5) return "MVFR";
  return "VFR";
}

/**
 * What set a village report's category (#149): its ceiling, its
 * visibility, or both. The client read FEW 400 with 3 SM as VFR: a FEW
 * layer is not a ceiling, but 3 SM is MVFR. Null when it's VFR or the
 * report gives neither.
 */
export function villageCategoryBecause(r: VillageWeatherReportResponse): string | null {
  const category = r.flight_category;
  if (!category || category === "VFR") return null;
  const ceiling =
    r.ceiling_ft != null && (!r.cloud_cover || CEILING_COVERS.has(r.cloud_cover)) ? r.ceiling_ft : null;
  const reasons: string[] = [];
  if (ceiling != null && band(ceiling, null) === category) {
    reasons.push(`ceiling ${ceiling.toLocaleString("en-US")} ft`);
  }
  if (r.visibility_sm != null && band(null, r.visibility_sm) === category) {
    reasons.push(`visibility ${villageVisibility(r.visibility_sm).replace(/SM$/, " SM")}`);
  }
  return reasons.length > 0 ? reasons.join(" and ") : null;
}
