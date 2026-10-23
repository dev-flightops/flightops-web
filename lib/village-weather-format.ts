import type { VillageWeatherReportResponse } from "@/lib/api/types";

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
