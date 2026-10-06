/**
 * The dispatch risk matrix (#50): the client's original packet scored a
 * flight severity × likelihood per factor, the worst row setting the
 * overall level. ops does the scoring; the page gathers each stop's
 * weather and airport data from weather-service and sends it, since the
 * services don't call each other (the FRAT prefill works the same way).
 */

import { flightStops } from "@/lib/route";

import { apiFetch } from "./client";
import { getFlight } from "./ops";
import type { WeatherBatchResponse } from "./types";
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

/** weather-service caps a batch at 30 (three kinds a stop) and /airports at 12. */
const MAX_STOPS = 10;
/** The release and the print don't wait longer than this for the packet's weather. */
const PACKET_WEATHER_TIMEOUT_MS = 8000;

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
 * Each stop's weather and airport record, as ops wants them. A stop the
 * weather service couldn't answer for goes without: ops then scores what
 * it can and says what it couldn't.
 */
export function riskStops(
  stops: string[],
  weather: WeatherBatchResponse | null,
  airports: AirportInfo[] | null,
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

/** Each stop's weather and airport record, gathered from weather-service. */
async function gatherStops(stops: string[]): Promise<RiskStopIn[]> {
  const unique = [...new Set(stops)].slice(0, MAX_STOPS);
  const [weather, airports] = await Promise.all([
    batchWeather(
      unique.flatMap((icao) => [
        { icao, kind: "metar" as const },
        { icao, kind: "taf" as const },
        { icao, kind: "pirep" as const },
      ]),
    ).catch(() => null),
    getAirports(unique).catch(() => null),
  ]);
  return riskStops(unique, weather, airports);
}

/** Gather the flight's weather and airport data, then have ops score it. */
export async function loadDispatchRisk(
  flightId: string,
  stops: string[],
): Promise<DispatchRisk> {
  return scoreFlightRisk(flightId, { stops: await gatherStops(stops) });
}

/**
 * The weather a dispatch packet prints (#52): each stop's reports and the
 * area forecast for the region the dispatcher chose. What can't be
 * fetched is left out, and the packet prints it as unavailable.
 */
export async function gatherPacketWeather(
  flightId: string,
  stops: string[],
): Promise<PacketWeather> {
  const [sent, inputs] = await Promise.all([
    gatherStops(stops),
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
      getFlight(flightId).then((flight) => gatherPacketWeather(flightId, flightStops(flight))),
      timeout,
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
