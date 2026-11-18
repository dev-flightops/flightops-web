import type { StopWeather } from "@/lib/api/dispatch-risk";

/**
 * Where a stop's weather came from (#117), for the packet's weather card
 * and the FRAT.
 *
 * The client, 26 Oct: the FRAT "should note in the FRAT where the weather
 * was sourced. Ideally where it says the source (metar) it could also
 * denote village wx, etc." Each element is from the first of the METAR, the
 * village report and the FAA WeatherCam that reports it (the client, 18
 * Nov: "Metar over everything. Village report maybe slightly higher than wx
 * cam."), so a stop can be scored on more than one, and a worse reading
 * further down is shown, not scored; ops says which (`StopWeather`), and
 * this only words it.
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

/** "Official METAR/TAF", with what fills in where the METAR has none
 *  ("Official METAR/TAF, and the village report where the METAR has
 *  none"), or the sources scored, e.g. "Village report · Not certified". */
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
    // Degrees get their sign; VRB and an agent's compass point (LOG-38) don't.
    const direction = /^\d+$/.test(stop.wind_direction ?? "") ? `${stop.wind_direction}°` : stop.wind_direction;
    const gust = stop.wind_gust_kt ? `G${stop.wind_gust_kt}` : "";
    lines.push(`Wind ${direction} @ ${stop.wind_kt}${gust} kt (${stop.wind_from})`);
  }
  return lines;
}

/** Worse readings further down the client's order, shown and not scored:
 *  the client, 18 Nov, "Metar over everything. Village report maybe
 *  slightly higher than wx cam." */
export function NotScored({ flags, className = "mt-3" }: { flags?: string[]; className?: string }) {
  if (!flags?.length) return null;
  return (
    <div className={`${className} border-l-[3px] border-l-status-yellow pl-3`}>
      <p className="eyebrow">Not scored</p>
      <ul className="mt-1 space-y-0.5 text-sm text-foreground">
        {flags.map((flag) => (
          <li key={flag}>{`${flag.charAt(0).toUpperCase()}${flag.slice(1)}`}</li>
        ))}
      </ul>
    </div>
  );
}

/** The stop's FAA WeatherCam page, to look at the pictures (the client,
 *  18 Nov: "can you put a link to wx cam so dispatch pilot can look at it
 *  in frat/packet?"). Only the FAA's page is linked. */
export function CameraLink({ url, site }: { url?: string | null; site?: string | null }) {
  if (!url || !isFaaCameraPage(url)) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2 hover:text-foreground"
    >
      {site ? `${site} cameras` : "Cameras"}
      <span className="sr-only"> (opens the FAA WeatherCams page)</span>
    </a>
  );
}

export function isFaaCameraPage(url: string): boolean {
  try {
    return new URL(url).hostname === "weathercams.faa.gov";
  } catch {
    return false;
  }
}
