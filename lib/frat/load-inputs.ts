/**
 * What the FRAT questionnaire scores from, for a flight (#155): the
 * route's weather and the prefill and block-FRAT answers worked out from
 * it. Shared by the pilot's preflight step and the flight's FRAT page, so
 * the pilot and dispatch see the same suggestions.
 *
 * Best-effort throughout: without weather the questionnaire behaves as it
 * did before the prefill existed.
 */

import { riskStops, weatherCamsFor } from "@/lib/api/dispatch-risk";
import { getFratBlockEligibility, getFratPrefill } from "@/lib/api/ops";
import type {
  FlightDetail,
  FratBlockEligibilityResponse,
  FratPrefillResponse,
  WeatherBatchResponse,
} from "@/lib/api/types";
import { batchWeather } from "@/lib/api/weather";
import { isIfrPlanned, observationsFromWeather } from "@/lib/frat/observations";
import { flightStops } from "@/lib/route";

export interface FratInputs {
  weather: WeatherBatchResponse | null;
  fratPrefill: FratPrefillResponse | null;
  fratBlock: FratBlockEligibilityResponse | null;
}

/** Deduped airports on the route, in order. */
export function routingAirports(flight: FlightDetail): string[] {
  return Array.from(new Set(flightStops(flight).filter(Boolean)));
}

export async function loadFratInputs(flight: FlightDetail): Promise<FratInputs> {
  const routeIcaos = routingAirports(flight);
  if (routeIcaos.length === 0) return { weather: null, fratPrefill: null, fratBlock: null };
  const reqs = routeIcaos.flatMap((icao) => [
    { icao, kind: "metar" as const },
    { icao, kind: "taf" as const },
    { icao, kind: "pirep" as const },
  ]);
  const [weather, cams] = await Promise.all([
    batchWeather(reqs).catch(() => null),
    weatherCamsFor(routeIcaos),
  ]);
  // Each stop's reports as the dispatch packet sends them (#117), so the
  // FRAT scores the same weather. The prefill runs even with no weather:
  // duty, rest, currency and maintenance need none. The block eligibility
  // compares weather, so it still needs some.
  const observations = observationsFromWeather(weather);
  const stops = riskStops(routeIcaos, weather, null, cams);
  const [fratPrefill, fratBlock] = await Promise.all([
    getFratPrefill(flight.id, { observations, stops, is_ifr: isIfrPlanned(flight) }).catch(
      () => null,
    ),
    observations.length > 0 || stops.some((stop) => stop.weathercam)
      ? getFratBlockEligibility(flight.id, {
          observations,
          stops,
          is_ifr: isIfrPlanned(flight),
        }).catch(() => null)
      : Promise.resolve(null),
  ]);
  return { weather, fratPrefill, fratBlock };
}
