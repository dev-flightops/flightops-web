import {
  AirportWeatherCard,
  type WeatherFetchOutcome,
} from "@/components/weather/airport-weather-card";
import { ApiError } from "@/lib/api/client";
import { batchWeather } from "@/lib/api/weather";
import type { WeatherReportResponse } from "@/lib/api/types";
import { utcHm } from "@/lib/weather-format";
import { parseIcaos } from "@/lib/weather/icaos";

import { IcaoInputForm } from "./icao-input-form";

/**
 * /weather — standalone multi-ICAO METAR + TAF lookup (M2-G-24).
 *
 * URL-driven via `?icaos=PANC,PAEN,PADU` so each lookup is deep-
 * linkable. Empty / missing param shows just the input form with a
 * coaching hint; otherwise the server component fans out via the
 * M2-M-12 batch endpoint (one round-trip per render).
 *
 * Lighter than the dispatch packet weather panel: no route role
 * tags, no 5-column field grid — that depth lives on the packet
 * where the dispatcher is making a release call. The standalone page
 * is for quick "what's the weather at PANC right now" lookups +
 * deep-linkable shares between dispatchers and pilots.
 *
 * Persistence is out of scope here. A `WeatherBriefing` model that
 * saves the result with dispatcher notes is M3 (legacy /weather/new
 * → briefing/{id} flow); for now the URL is the persistence layer.
 */
const MAX_AIRPORTS = 10;

export default async function WeatherPage({
  searchParams,
}: {
  searchParams: Promise<{ icaos?: string }>;
}) {
  const { icaos: icaosParam } = await searchParams;
  const icaos = parseIcaos(icaosParam ?? "").slice(0, MAX_AIRPORTS);

  // Fetch eagerly inside the page render so the test harness sees a
  // fully-resolved tree (nested async server components rely on
  // Next's Suspense plumbing that jsdom doesn't have).
  let items: WeatherReportResponse[] = [];
  let errors: { icao: string; kind: string; status: number; detail: string }[] = [];
  let loadError: string | null = null;
  if (icaos.length > 0) {
    try {
      const response = await batchWeather(
        icaos.flatMap((icao) => [
          { icao, kind: "metar" as const },
          { icao, kind: "taf" as const },
        ]),
      );
      items = response.items;
      errors = response.errors;
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      loadError =
        status === 401
          ? "Your session expired — please sign in again."
          : "Weather feed unavailable. Try again in a moment.";
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Weather
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Live METAR + TAF for the airports you enter. Backend caches
          METAR 5 min, TAF 30 min.
        </p>
      </header>

      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <IcaoInputForm initialIcaos={icaos} />
      </div>

      {icaos.length === 0 ? (
        <EmptyState />
      ) : loadError ? (
        <div
          role="alert"
          className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : (
        <Results icaos={icaos} items={items} errors={errors} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-12 text-center">
      <p className="text-sm text-muted-foreground">
        Enter one or more airports above to pull current weather.
      </p>
      <p className="mt-2 text-[0.65rem] text-muted-foreground/70">
        Try{" "}
        <code className="font-mono">PANC PAEN PADU</code> — Anchorage,
        Kenai, Unalaska/Dutch Harbor.
      </p>
    </div>
  );
}

function Results({
  icaos,
  items,
  errors,
}: {
  icaos: string[];
  items: WeatherReportResponse[];
  errors: { icao: string; kind: string; status: number; detail: string }[];
}) {
  const reportLookup = new Map<string, WeatherReportResponse>();
  for (const item of items) {
    reportLookup.set(`${item.icao}/${item.kind}`, item);
  }
  const errorLookup = new Map<string, { status: number; detail: string }>();
  for (const err of errors) {
    errorLookup.set(`${err.icao}/${err.kind}`, {
      status: err.status,
      detail: err.detail,
    });
  }

  const cards = icaos.map((icao) => ({
    icao,
    metar: outcomeFor(icao, "metar", reportLookup, errorLookup),
    taf: outcomeFor(icao, "taf", reportLookup, errorLookup),
  }));

  const pulledAt = items
    .map((i) => i.parsed_at)
    .sort()
    .pop();

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-[0.65rem] text-muted-foreground">
          {icaos.length} {icaos.length === 1 ? "airport" : "airports"}
          {pulledAt ? ` · pulled ${utcHm(pulledAt)}` : ""}
        </p>
      </div>
      <div className="space-y-3">
        {cards.map((c) => (
          <AirportWeatherCard
            key={c.icao}
            icao={c.icao}
            metar={c.metar}
            taf={c.taf}
          />
        ))}
      </div>
    </>
  );
}

function outcomeFor(
  icao: string,
  kind: "metar" | "taf",
  ok: Map<string, WeatherReportResponse>,
  bad: Map<string, { status: number; detail: string }>,
): WeatherFetchOutcome {
  const report = ok.get(`${icao}/${kind}`);
  if (report) return { ok: true, report };
  const err = bad.get(`${icao}/${kind}`);
  if (err) return { ok: false, status: err.status, message: err.detail };
  return { ok: false, status: 0, message: `no ${kind} returned for ${icao}` };
}
