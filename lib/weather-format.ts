/**
 * Format helpers for the rich METAR card (M2-G-14).
 *
 * Each function takes the relevant fields from `WeatherReportResponse` and
 * returns a human-readable string. Kept in a separate module so they can
 * be unit-tested without rendering React, and so the component file stays
 * focused on layout.
 *
 * Style note: legacy uses sentence-case for the category ("Vfr") and
 * lowercase units ("kts", "sm", "ft", "°c", "inhg"). We match that here
 * — it's the dispatcher convention rather than a typo.
 */

import type { FlightCategory, WeatherReportResponse } from "@/lib/api/types";

export type RouteRole = "DEPARTURE" | "EN ROUTE" | "DESTINATION";

/** Returns the legacy-style role tag for an ICAO based on its position in
 *  the route. Single-stop routes get no tag (return null). */
export function routeRoleFor(
  index: number,
  total: number,
): RouteRole | null {
  if (total <= 1) return null;
  if (index === 0) return "DEPARTURE";
  if (index === total - 1) return "DESTINATION";
  return "EN ROUTE";
}

/** When a METAR was observed, from its "DDHHMMZ" stamp: the report's own
 *  time, as the server's stale-weather check reads it
 *  (weather_sources.parse_metar_observed_at). The stamp has no month, so a
 *  day after today's is last month's. Null when there is no stamp or it
 *  isn't a real date. */
export function metarObservedAt(raw: string, now: Date = new Date()): Date | null {
  const match = /\b(\d{2})(\d{2})(\d{2})Z\b/.exec(raw ?? "");
  if (!match) return null;
  const [day, hour, minute] = match.slice(1).map(Number);
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  if (day > now.getUTCDate()) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  const at = new Date(Date.UTC(year, month, day, hour, minute));
  // The 31st of a 30-day month, hour 24, minute 60: a corrupt stamp.
  if (at.getUTCDate() !== day || at.getUTCHours() !== hour || at.getUTCMinutes() !== minute) return null;
  return at;
}

/** A METAR's age (1119-10): from when it was observed, not when FlightOps
 *  fetched it. PADM's card read "just now" for a report 8 hr 56 min old,
 *  while the stale-weather box beside it asked for an acknowledgment. */
export function reportAge(report: { raw: string; parsed_at: string }, now: Date = new Date()): string {
  const observed = metarObservedAt(report.raw, now);
  return metarAge(observed ? observed.toISOString() : report.parsed_at, now);
}

/** Format METAR age relative to `now` as "X min" / "Xh Ym" / "just now".
 *  `now` is injected so tests can lock the clock. */
export function metarAge(
  parsedAt: string,
  now: Date = new Date(),
): string {
  const ageMs = now.getTime() - new Date(parsedAt).getTime();
  if (ageMs < 30_000) return "just now";
  const ageMin = Math.floor(ageMs / 60_000);
  if (ageMin < 60) return `${ageMin} min`;
  const hours = Math.floor(ageMin / 60);
  const mins = ageMin % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

/**
 * "SPECI 16:59Z" when the report is a special observation, else null.
 *
 * A station issues a SPECI between its routine hourly METARs when
 * conditions change enough to matter, such as a ceiling forming below
 * 1,000 ft. The client read Peregrine's PABE "ceiling 500 ft, IFR" as
 * miscoded weather because other sites showed the 16:53Z METAR
 * (FEW005); Peregrine showed the 16:59Z SPECI (BKN005), the newer report
 * (#71). Saying so on the card is what was missing.
 */
export function specialReport(raw: string): string | null {
  const m = /^SPECI\s+[A-Z0-9]{3,4}\s+\d{2}(\d{2})(\d{2})Z\b/.exec(raw.trim());
  return m ? `SPECI ${m[1]}:${m[2]}Z` : null;
}

/** "12:34Z" — server-side timestamp formatter that doesn't depend on
 *  the browser's locale settings. */
export function utcHm(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}Z`;
}

/** Sentence-case the category as legacy does ("VFR" -> "Vfr"). */
function sentenceCaseCategory(cat: FlightCategory): string {
  // VFR → Vfr, MVFR → Mvfr, IFR → Ifr, LIFR → Lifr
  return cat.charAt(0) + cat.slice(1).toLowerCase();
}

/** Build the legacy-style one-line summary:
 *  "Vfr, wind 270° at 8 kts, visibility 10.0 sm, ceiling 4000 ft,
 *   temp 14°c / dewpoint 4°c, altimeter 29.66 inhg"
 *
 *  Pieces that aren't parseable are silently dropped — partial summaries
 *  beat blank ones. */
export function metarSummary(r: WeatherReportResponse): string {
  const parts: string[] = [];

  if (r.flight_category) parts.push(sentenceCaseCategory(r.flight_category));

  const wind = formatWindSentence(r);
  if (wind) parts.push(wind);

  if (r.visibility_sm !== null) {
    parts.push(`visibility ${r.visibility_sm.toFixed(1)} sm`);
  }
  if (r.ceiling_ft !== null) {
    // Summary uses the raw number ("4000 ft") for sentence flow; the
    // field-grid cell adds the comma separator separately.
    parts.push(`ceiling ${r.ceiling_ft} ft`);
  } else if (r.visibility_sm !== null) {
    // No BKN/OVC/VV layer + we had visibility data → sky clear.
    // Only render when we know vis (so we don't claim "sky clear" for a
    // METAR we couldn't parse at all).
    parts.push("sky clear");
  }
  if (r.temp_c !== null && r.dewpoint_c !== null) {
    parts.push(`temp ${r.temp_c}°c / dewpoint ${r.dewpoint_c}°c`);
  } else if (r.temp_c !== null) {
    parts.push(`temp ${r.temp_c}°c`);
  }
  if (r.altimeter_in_hg !== null) {
    parts.push(`altimeter ${r.altimeter_in_hg.toFixed(2)} inhg`);
  }

  return parts.join(", ");
}

function formatWindSentence(r: WeatherReportResponse): string | null {
  if (r.wind_calm) return "wind calm";
  if (r.wind_speed_kt === null) return null;
  if (r.wind_variable) {
    return r.wind_gust_kt
      ? `wind variable at ${r.wind_speed_kt} kts, gusting ${r.wind_gust_kt}`
      : `wind variable at ${r.wind_speed_kt} kts`;
  }
  if (r.wind_direction_deg === null) return null;
  const base = `wind ${padDeg(r.wind_direction_deg)}° at ${r.wind_speed_kt} kts`;
  return r.wind_gust_kt ? `${base}, gusting ${r.wind_gust_kt}` : base;
}

function padDeg(deg: number): string {
  return String(deg).padStart(3, "0");
}

/** Field-grid value formatters. Each returns "—" when the field is null
 *  so the grid keeps its shape (5 columns, never collapsing). */
export const fieldFormat = {
  ceiling: (r: WeatherReportResponse): string =>
    r.ceiling_ft === null ? "Clear" : `${r.ceiling_ft.toLocaleString()} ft`,

  visibility: (r: WeatherReportResponse): string =>
    r.visibility_sm === null ? "—" : `${r.visibility_sm.toFixed(1)} SM`,

  wind: (r: WeatherReportResponse): string => {
    if (r.wind_calm) return "Calm";
    if (r.wind_speed_kt === null) return "—";
    if (r.wind_variable) {
      return r.wind_gust_kt
        ? `VRB @ ${r.wind_speed_kt}G${r.wind_gust_kt} kt`
        : `VRB @ ${r.wind_speed_kt} kt`;
    }
    if (r.wind_direction_deg === null) return "—";
    return r.wind_gust_kt
      ? `${padDeg(r.wind_direction_deg)}° @ ${r.wind_speed_kt}G${r.wind_gust_kt} kt`
      : `${padDeg(r.wind_direction_deg)}° @ ${r.wind_speed_kt} kt`;
  },

  tempDew: (r: WeatherReportResponse): string => {
    if (r.temp_c === null) return "—";
    if (r.dewpoint_c === null) return `${r.temp_c}°C`;
    return `${r.temp_c}°C / ${r.dewpoint_c}°C`;
  },

  altimeter: (r: WeatherReportResponse): string =>
    r.altimeter_in_hg === null ? "—" : `${r.altimeter_in_hg.toFixed(2)} inHg`,
};

/** "METAR 13:53Z" or "SPECI 13:59Z": when the report was observed, from
 *  the report's own time group when the service didn't say. Never the
 *  time it was fetched (`parsed_at`), which would make older conditions
 *  look newer (Codex, web #501, on My Flights). Null when neither is known. */
export function observedLabel(r: WeatherReportResponse): string | null {
  const kind = /^SPECI\b/.test(r.raw.trim()) ? "SPECI" : "METAR";
  if (r.observed_at) {
    const at = new Date(r.observed_at);
    if (!Number.isNaN(at.getTime())) return `${kind} ${at.toISOString().slice(11, 16)}Z`;
  }
  const group = /\b\d{2}(\d{2})(\d{2})Z\b/.exec(r.raw);
  return group ? `${kind} ${group[1]}:${group[2]}Z` : null;
}
