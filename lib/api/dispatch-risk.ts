/**
 * The dispatch risk matrix (#50): the client's original packet scored a
 * flight severity × likelihood per factor, the worst row setting the
 * overall level. ops does the scoring; the page gathers each stop's
 * weather and airport data from weather-service and sends it, since the
 * services don't call each other (the FRAT prefill works the same way).
 */

import { alternateOf, flightStops } from "@/lib/route";

import { apiFetch } from "./client";
import { getFlight } from "./ops";
import type { WeatherBatchResponse, WeatherReportResponse } from "./types";
import { batchWeather } from "./weather";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type RiskSource = "auto" | "dispatcher";

export interface RiskRow {
  factor: string;
  severity: number | null;
  likelihood: number | null;
  score: number | null;
  level: RiskLevel | null;
  comment: string;
  /** "dispatcher" when an override or the dispatcher's own answer set it. */
  source: RiskSource;
}

/** What the system worked out for an input the dispatcher can override. */
export interface AutoAnswer {
  value: boolean | null;
  note: string;
}

export interface DispatchRiskInputs {
  flight_id: string;
  outside_pilot_restrictions: boolean;
  vfr_mountain_night: boolean;
  management_approval_obtained: boolean;
  hazmat_approved: boolean;
  mel_actions_complete: boolean;
  /** Overrides: null means "use what the system worked out". */
  reporting_override: boolean | null;
  night_override: boolean | null;
  crosswind_override_kt: number | null;
  maintenance_override: boolean | null;
  mel_override: boolean | null;
  mel_actions_override: boolean | null;
  hazmat_override: boolean | null;
  non_certified_notes: string | null;
  dispatcher_notes: string | null;
  /** The area forecast the packet prints, e.g. "FAAK58". */
  area_forecast_product: string | null;
  updated_by: { id: string; full_name: string; email: string } | null;
  updated_at: string | null;
}

/** A save sends only what changed. */
export type DispatchRiskInputsPatch = Partial<
  Omit<DispatchRiskInputs, "flight_id" | "updated_by" | "updated_at">
>;

export interface DispatchRisk {
  flight_id: string;
  rows: RiskRow[];
  max_score: number;
  level: RiskLevel;
  management_required: boolean;
  concerns: string[];
  summary: string;
  inputs: DispatchRiskInputs;
  /** Each stop's weather and where it came from (#117), route order. */
  stops?: StopWeather[];
  /** Some stop's weather used isn't certified: say so (#117). */
  non_certified_weather?: boolean;
  automatic: {
    reporting: AutoAnswer;
    night: AutoAnswer;
    crosswind_kt: number | null;
    maintenance: AutoAnswer;
    mel: AutoAnswer;
    hazmat: AutoAnswer;
  };
}

export interface AirportRunway {
  name: string;
  length_ft: number;
  width_ft: number;
  surface: string | null;
  true_alignment_deg: number | null;
}

export interface AirportInfo {
  ident: string;
  found: boolean;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  elevation_ft: number | null;
  runways: AirportRunway[];
}

export interface AreaForecastRegion {
  product: string;
  region: string;
}

/** An FAA WeatherCam site's reading as ops takes it (#117). Not certified:
 *  "vwos" is the site's visual weather observation, "estimate" the
 *  cameras' estimated visibility alone, and "none" a site with no current
 *  reading, sent for its page and never scored (the client, 18 Nov: "can
 *  you put a link to wx cam so dispatch pilot can look at it in
 *  frat/packet?"). */
export interface WeatherCamIn {
  site_name: string;
  kind: "vwos" | "estimate" | "none";
  observed_at: string | null;
  raw: string | null;
  reports_sky: boolean;
  ceiling_ft: number | null;
  visibility_sm: number | null;
  wind_direction_deg: number | null;
  wind_speed_kt: number | null;
  wind_gust_kt: number | null;
  page_url: string | null;
}

export interface RiskStopIn {
  ident: string;
  metar: string | null;
  taf: string | null;
  /** "" when there were none; null when they couldn't be fetched. */
  pireps: string | null;
  airport?: {
    found: boolean;
    latitude: number | null;
    longitude: number | null;
    runways: Array<Omit<AirportRunway, "surface">>;
  };
  weathercam?: WeatherCamIn | null;
}

/** Where a stop's weather came from (#117). Each element is from the first
 *  of the METAR, the village report and the FAA WeatherCam that reports it
 *  (the client, 18 Nov: "Metar over everything. Village report maybe
 *  slightly higher than wx cam."), and names which ("METAR", "village
 *  report", "FAA WeatherCam", "FAA WeatherCam estimate"). `source` is the
 *  first of them used. A null ceiling with a `ceiling_from` is a clear sky. */
export interface StopWeather {
  ident: string;
  /** "taf": a flight more than an hour off, scored on the TAF for its time
   *  at the stop (1119-03). */
  source: "taf" | "metar" | "weathercam" | "village" | "taf_temporary" | null;
  certified: boolean;
  /** e.g. "METAR and village report, not certified". */
  described: string;
  ceiling_ft: number | null;
  ceiling_from: string | null;
  visibility_sm: number | null;
  visibility_from: string | null;
  wind_direction: string | null;
  wind_kt: number | null;
  wind_gust_kt: number | null;
  wind_from: string | null;
  /** Worse readings further down the client's order, shown and not
   *  scored: "visibility 1.5 SM from the FAA WeatherCam estimate, not
   *  scored: the METAR comes first". Absent from an older service. */
  flags?: string[];
  /** The stop's FAA WeatherCam site and its page, to look at. */
  camera_site?: string | null;
  camera_url?: string | null;
}

/** The area forecast for a region, as weather-service returns it (#51). */
export interface AreaForecast {
  product: string;
  region: string;
  text: string;
  issued_at: string | null;
  source_url: string;
}

/** The weather a dispatch packet prints (#52). */
export interface PacketWeather {
  stops: RiskStopIn[];
  area_forecast: AreaForecast | null;
}

/** weather-service caps a batch at 40 (four kinds a stop) and /airports at 12. */
const MAX_STOPS = 10;
/** The FAA WeatherCams page is read in a browser (#117): its readings
 *  wait no longer than this, and the METARs don't wait on them at all. */
const WEATHERCAM_TIMEOUT_MS = 12000;
/** The release and the print don't wait longer than this for the packet's
 *  weather. A cold cache under load took over 8 s on the test stack. */
const PACKET_WEATHER_TIMEOUT_MS = 15000;

export async function getAirports(idents: string[]): Promise<AirportInfo[]> {
  const query = encodeURIComponent(idents.join(","));
  return (await apiFetch<{ airports: AirportInfo[] }>(`/weather/airports?ids=${query}`))
    .airports;
}

export async function getAreaForecastRegions(): Promise<AreaForecastRegion[]> {
  return (await apiFetch<{ regions: AreaForecastRegion[] }>(`/weather/area-forecasts`)).regions;
}

export async function getRiskInputs(flightId: string): Promise<DispatchRiskInputs> {
  return apiFetch<DispatchRiskInputs>(`/ops/dispatch/${flightId}/risk-inputs`);
}

export async function getAreaForecast(product: string): Promise<AreaForecast> {
  return apiFetch<AreaForecast>(`/weather/area-forecasts/${encodeURIComponent(product)}`);
}

export async function scoreFlightRisk(
  flightId: string,
  body: { stops: RiskStopIn[] },
): Promise<DispatchRisk> {
  return apiFetch<DispatchRisk>(`/ops/dispatch/${flightId}/risk`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchDispatchRiskInputs(
  flightId: string,
  patch: DispatchRiskInputsPatch,
): Promise<DispatchRiskInputs> {
  return apiFetch<DispatchRiskInputs>(`/ops/dispatch/${flightId}/risk-inputs`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/**
 * Each stop's FAA WeatherCam reading (#117), in a batch of its own so the
 * METARs never wait on the FAA's page. Null when it can't be had in time;
 * a stop without a site is simply absent.
 */
export async function weatherCamsFor(icaos: string[]): Promise<WeatherBatchResponse | null> {
  if (icaos.length === 0) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), WEATHERCAM_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      batchWeather(icaos.map((icao) => ({ icao, kind: "wxcam" as const }))),
      timeout,
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** A WeatherCam reading from the weather service, as ops takes it. */
export function weatherCamIn(report: WeatherReportResponse | undefined): WeatherCamIn | null {
  if (!report || report.kind !== "wxcam") return null;
  if (!report.observed_at) {
    // A site with nothing current: its page alone, for the FRAT's and the
    // packet's link.
    return report.site_url
      ? {
          site_name: report.site_name ?? "",
          kind: "none",
          observed_at: null,
          raw: null,
          reports_sky: false,
          ceiling_ft: null,
          visibility_sm: null,
          wind_direction_deg: null,
          wind_speed_kt: null,
          wind_gust_kt: null,
          page_url: report.site_url,
        }
      : null;
  }
  return {
    site_name: report.site_name ?? "",
    kind: report.estimate ? "estimate" : "vwos",
    observed_at: report.observed_at,
    raw: report.estimate ? null : report.raw,
    reports_sky: Boolean(report.reports_sky),
    ceiling_ft: report.ceiling_ft,
    visibility_sm: report.visibility_sm,
    wind_direction_deg: report.wind_direction_deg,
    wind_speed_kt: report.wind_speed_kt,
    wind_gust_kt: report.wind_gust_kt,
    page_url: report.site_url ?? null,
  };
}

/**
 * Each stop's weather and airport record, as ops wants them. A stop the
 * weather service couldn't answer for goes without: ops then scores what
 * it can and says what it couldn't.
 */
export function riskStops(
  stops: string[],
  weather: WeatherBatchResponse | null,
  airports: AirportInfo[] | null,
  cams: WeatherBatchResponse | null = null,
): RiskStopIn[] {
  const raw = (icao: string, kind: string) =>
    weather?.items.find((i) => i.icao === icao && i.kind === kind)?.raw ?? null;
  return stops.map((icao) => {
    const airport = airports?.find((a) => a.ident === icao);
    return {
      ident: icao,
      metar: raw(icao, "metar"),
      taf: raw(icao, "taf"),
      pireps: raw(icao, "pirep"),
      weathercam: weatherCamIn(cams?.items.find((i) => i.icao === icao && i.kind === "wxcam")),
      ...(airport && {
        airport: {
          found: airport.found,
          latitude: airport.latitude,
          longitude: airport.longitude,
          runways: airport.runways.map(({ name, length_ft, width_ft, true_alignment_deg }) => ({
            name,
            length_ft,
            width_ft,
            true_alignment_deg,
          })),
        },
      }),
    };
  });
}

/** Each stop's weather and airport record, gathered from weather-service.
 *  An IFR flight's `alternate` (1119-18) comes after the route's cap, so a
 *  route at the cap doesn't drop it, with its weather alone: the airport
 *  lookup takes ten, and the alternate's runways aren't scored. */
async function gatherStops(stops: string[], alternate: string | null = null): Promise<RiskStopIn[]> {
  const unique = [...new Set(stops)].slice(0, MAX_STOPS);
  const alt = alternate?.trim().toUpperCase() || null;
  const weighed = alt && !unique.includes(alt) ? [...unique, alt] : unique;
  const [weather, airports, cams] = await Promise.all([
    batchWeather(
      weighed.flatMap((icao) => [
        { icao, kind: "metar" as const },
        { icao, kind: "taf" as const },
        { icao, kind: "pirep" as const },
      ]),
    ).catch(() => null),
    getAirports(unique).catch(() => null),
    weatherCamsFor(unique),
  ]);
  return riskStops(weighed, weather, airports, cams);
}

/** Gather the flight's weather and airport data, then have ops score it,
 *  with an IFR flight's alternate (1119-18). */
export async function loadDispatchRisk(
  flightId: string,
  stops: string[],
  alternate: string | null = null,
): Promise<DispatchRisk> {
  return scoreFlightRisk(flightId, { stops: await gatherStops(stops, alternate) });
}

/**
 * The weather a dispatch packet prints (#52): each stop's reports and the
 * area forecast for the region the dispatcher chose. What can't be
 * fetched is left out, and the packet prints it as unavailable.
 *
 * An IFR flight's alternate comes too, as the page sends it to be scored
 * (1119-18): the release scores the flight again from this weather, and an
 * alternate it can't see scores HIGH. Left out, every IFR flight with an
 * alternate was refused at release for a HIGH risk that the page, scored
 * with the alternate's weather, didn't show, so the Chief Pilot or DO had
 * nothing to approve (PGR800, 24 Nov). The print walks the route, so the
 * alternate's reports don't change it.
 */
export async function gatherPacketWeather(
  flightId: string,
  stops: string[],
  alternate: string | null = null,
): Promise<PacketWeather> {
  const [sent, inputs] = await Promise.all([
    gatherStops(stops, alternate),
    getRiskInputs(flightId).catch(() => null),
  ]);
  const product = inputs?.area_forecast_product;
  const forecast = product ? await getAreaForecast(product).catch(() => null) : null;
  return {
    stops: sent,
    area_forecast: forecast && {
      product: forecast.product,
      region: forecast.region,
      text: forecast.text,
      issued_at: forecast.issued_at,
      source_url: forecast.source_url,
    },
  };
}

/**
 * The packet's weather for a flight, for the release to keep and the print
 * to fall back on. Null when it can't be had in time: the release goes
 * ahead without it, and the packet then says so.
 */
export async function packetWeatherFor(flightId: string): Promise<PacketWeather | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), PACKET_WEATHER_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      getFlight(flightId).then((flight) =>
        gatherPacketWeather(flightId, flightStops(flight), alternateOf(flight)),
      ),
      timeout,
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
