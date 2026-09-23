import type {
  FratObservation,
  WeatherBatchResponse,
  WeatherReportResponse,
} from "@/lib/api/types";

/**
 * Turn the weather the preflight page already has into FRAT prefill
 * observations.
 *
 * Step 3 fetches METAR and TAF for every routing airport. The FRAT's
 * wind, ceiling and visibility factors are scored against exactly those
 * numbers, so the page has what the prefill needs before the pilot
 * reaches step 4 — it just never passed them anywhere.
 *
 * WHY THE ADAPTER IS HERE AND THE SCORING IS NOT
 *
 * ops-service makes no cross-service calls, so it cannot fetch the
 * METAR itself, and the operator's limits live on ops-service, so the
 * browser should not be applying them. The split is: this module says
 * what was observed, the backend says what it means. Nothing here knows
 * a threshold, which is the point — a second copy of the crosswind and
 * VFR limits in TypeScript is the drift this codebase keeps finding.
 */

/** METAR only. A TAF is a forecast over a period and its parsed fields
 *  are null anyway, so including them would contribute nothing and
 *  risk reading a forecast as an observation. */
function isMetarObservation(r: WeatherReportResponse): boolean {
  return r.kind === "metar";
}

export function observationsFromWeather(
  weather: WeatherBatchResponse | null | undefined,
): FratObservation[] {
  if (!weather?.items?.length) return [];

  const byIcao = new Map<string, FratObservation>();

  for (const report of weather.items) {
    if (!isMetarObservation(report)) continue;

    // A calm METAR reports no wind speed. That is 0 kt, not unknown —
    // and it matters, because the backend treats null as "no
    // observation" and refuses to score, while 0 is a real answer.
    const wind =
      report.wind_calm && report.wind_speed_kt == null
        ? 0
        : report.wind_speed_kt;

    byIcao.set(report.icao.toUpperCase(), {
      icao: report.icao.toUpperCase(),
      // Null ceiling is an unlimited one (clear or scattered-only), and
      // the backend knows that — it is passed through rather than
      // converted, because turning it into a number here would invent
      // a ceiling and turning it into "missing" would hide a clear sky.
      ceiling_ft: report.ceiling_ft,
      visibility_sm: report.visibility_sm,
      wind_kt: wind,
      gust_kt: report.wind_gust_kt,
    });
  }

  return [...byIcao.values()];
}

/**
 * Whether the flight is being planned IFR, as far as this page knows.
 *
 * Returns false when nothing says otherwise, and that is deliberate:
 * the consequence of `true` is that the weather factors come back
 * unscored, so guessing IFR would silently remove two suggestions the
 * pilot would otherwise get. Guessing VFR at worst offers a suggestion
 * against the VFR floor, which is visible and can be overridden.
 *
 * The flight record carries no IFR flag today — the dispatch packet has
 * an IFR/VFR compliance gate, but it is dispatcher-set on the packet
 * rather than stored on the flight. When that lands, read it here.
 */
export function isIfrPlanned(): boolean {
  return false;
}
