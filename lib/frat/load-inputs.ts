/**
 * What the FRAT questionnaire scores from, for a flight (#155): the
 * route's weather and the prefill and block-FRAT answers worked out from
 * it. Shared by the pilot's preflight step and the flight's FRAT page, so
 * the pilot and dispatch see the same suggestions.
 *
 * Best-effort throughout: without weather the questionnaire behaves as it
 * did before the prefill existed.
 */

import { getAirports, riskStops, scoreFlightRisk, weatherCamsFor } from "@/lib/api/dispatch-risk";
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

export async function loadFratInputs(
  flight: FlightDetail,
  {
    scorePacket = false,
  }: {
    /** Score the dispatch packet again from this weather first (17 Nov):
     *  the FRAT page's refresh is the packet's too. */
    scorePacket?: boolean;
  } = {},
): Promise<FratInputs> {
  const routeIcaos = routingAirports(flight);
  if (routeIcaos.length === 0) return { weather: null, fratPrefill: null, fratBlock: null };
  const reqs = routeIcaos.flatMap((icao) => [
    { icao, kind: "metar" as const },
    { icao, kind: "taf" as const },
    { icao, kind: "pirep" as const },
  ]);
  const [weather, cams, airports] = await Promise.all([
    batchWeather(reqs).catch(() => null),
    weatherCamsFor(routeIcaos),
    scorePacket ? getAirports(routeIcaos).catch(() => null) : Promise.resolve(null),
  ]);
  // The client, 17 Nov: "if dispatcher refreshes the data and then it goes
  // back to low, the FRAT should also go back to low." The FRAT's level now
  // follows the packet's latest score, so the FRAT page scores the packet
  // again from the weather just gathered, as the packet page does, before
  // the prefill and the FRAT read the packet's level. Best-effort: without
  // it they read the score saved last.
  if (scorePacket) {
    await scoreFlightRisk(flight.id, { stops: riskStops(routeIcaos, weather, airports, cams) }).catch(
      () => null,
    );
  }
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
    // A camera site with no current reading is sent for its page alone.
    observations.length > 0 || stops.some((stop) => stop.weathercam && stop.weathercam.kind !== "none")
      ? getFratBlockEligibility(flight.id, {
          observations,
          stops,
          is_ifr: isIfrPlanned(flight),
        }).catch(() => null)
      : Promise.resolve(null),
  ]);
  return { weather, fratPrefill, fratBlock };
}
