/**
 * The dispatch risk matrix (#50): the client's original packet scored a
 * flight severity × likelihood per factor, the worst row setting the
 * overall level. ops does the scoring; the page gathers each stop's
 * weather and airport data from weather-service and sends it, since the
 * services don't call each other (the FRAT prefill works the same way).
 */

import { apiFetch } from "./client";
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

interface RiskStopIn {
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

/** weather-service caps a batch at 30 (three kinds a stop) and /airports at 12. */
const MAX_STOPS = 10;

export async function getAirports(idents: string[]): Promise<AirportInfo[]> {
  const query = encodeURIComponent(idents.join(","));
  return (await apiFetch<{ airports: AirportInfo[] }>(`/weather/airports?ids=${query}`))
    .airports;
}

export async function getAreaForecastRegions(): Promise<AreaForecastRegion[]> {
  return (await apiFetch<{ regions: AreaForecastRegion[] }>(`/weather/area-forecasts`)).regions;
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

/** Gather the flight's weather and airport data, then have ops score it. */
export async function loadDispatchRisk(
  flightId: string,
  stops: string[],
): Promise<DispatchRisk> {
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
  return scoreFlightRisk(flightId, { stops: riskStops(unique, weather, airports) });
}
