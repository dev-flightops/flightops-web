import type { StopWeather } from "@/lib/api/dispatch-risk";

/**
 * Where a stop's weather came from (#117), for the packet's weather card
 * and the FRAT.
 *
 * The client, 26 Oct: the FRAT "should note in the FRAT where the weather
 * was sourced. Ideally where it says the source (metar) it could also
 * denote village wx, etc." Each element is the worst of the METAR, the FAA
 * WeatherCam and the village report, so a stop can be scored on more than
 * one; ops says which (`StopWeather`), and this only words it.
 */

/** The client's notice, word for word with the packet PDF's
 *  (flightops_shared.weather_sources.NOT_CERTIFIED_NOTICE): "A simple alert
 *  telling them that only a company with an approved OpSpec should use the
 *  non certified weather for dispatch". */
export const NOT_CERTIFIED_NOTICE =
  "Only an operator whose OpSpecs authorize non-certified weather may use it for dispatch.";

export function NonCertifiedWeatherNotice() {
  return (
    <div role="note" className="notice notice-yellow text-xs">
      <p className="notice-label">Not certified weather</p>
      <p className="mt-1 text-foreground">{NOT_CERTIFIED_NOTICE}</p>
    </div>
  );
}

/** "Official METAR/TAF", with a worse reading beside it named (#151:
 *  "Official METAR/TAF, and the FAA WeatherCam estimate where worse"), or
 *  the sources scored, e.g. "Village report · Not certified". */
export function sourceLabel(stop: StopWeather): string {
  if (stop.certified) {
    return stop.described.startsWith("METAR")
      ? `Official METAR/TAF${stop.described.slice("METAR".length)}`
      : "Official METAR/TAF";
  }
  if (!stop.source) return "No weather";
  const names = stop.described.replace(/, not certified$/, "");
  return `${names.charAt(0).toUpperCase()}${names.slice(1)} · Not certified`;
}

function miles(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "");
}

/** Each element the stop's score took from somewhere other than the METAR,
 *  e.g. "Ceiling 500 ft (village report)". */
export function scoredElsewhere(stop: StopWeather): string[] {
  const lines: string[] = [];
  if (stop.ceiling_from && stop.ceiling_from !== "METAR") {
    // "No ceiling", not "clear" (#149): a FEW or SCT layer is reported
    // but isn't a ceiling.
    lines.push(
      stop.ceiling_ft === null
        ? `No ceiling (${stop.ceiling_from})`
        : `Ceiling ${stop.ceiling_ft.toLocaleString()} ft (${stop.ceiling_from})`,
    );
  }
  if (stop.visibility_from && stop.visibility_from !== "METAR" && stop.visibility_sm !== null) {
    lines.push(`Visibility ${miles(stop.visibility_sm)} SM (${stop.visibility_from})`);
  }
  if (stop.wind_from && stop.wind_from !== "METAR" && stop.wind_kt !== null) {
    const direction = stop.wind_direction === "VRB" ? "VRB" : `${stop.wind_direction}°`;
    const gust = stop.wind_gust_kt ? `G${stop.wind_gust_kt}` : "";
    lines.push(`Wind ${direction} @ ${stop.wind_kt}${gust} kt (${stop.wind_from})`);
  }
  return lines;
}
