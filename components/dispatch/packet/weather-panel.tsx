import { ApiError } from "@/lib/api/client";
import { getMetar, getTaf } from "@/lib/api/weather";
import type { FlightDetail, WeatherReportResponse } from "@/lib/api/types";

import { DisabledPanel, SectionPanel } from "./section-panel";

/**
 * Weather & ATIS panel — replaces the M1 DisabledPanel placeholder.
 *
 * Pulls METAR + TAF for the selected flight's origin and destination from
 * the backend weather-service (M2-M-3). Both ICAOs are fetched in parallel
 * so the worst-case render time is one AWC round-trip, not four.
 *
 * `cache_hit` on each response drives a small "live" / "cached" badge so
 * dispatchers know when they're looking at fresh data vs a cached row.
 *
 * Failure handling: per-report. If METAR fetches but TAF 404s, we render
 * METAR + a "no TAF" note rather than failing the whole panel. AWC 502s
 * surface as "weather feed unreachable" rather than throwing.
 */
export async function WeatherPanel({
  flight,
}: {
  flight: FlightDetail | null;
}) {
  if (!flight) {
    return (
      <DisabledPanel
        title="Weather & ATIS"
        milestone="M2"
        hint="Pick a flight from the dropdown above to pull METAR + TAF for the origin and destination."
      />
    );
  }

  // Deduplicate the ICAOs in case origin == destination (uncommon but
  // possible for training / circling flights).
  const icaos = Array.from(new Set([flight.origin, flight.destination]));

  // Parallel fetch — one round-trip per (icao, kind), but all in flight at
  // once. Each promise's failure is caught individually so one missing
  // report doesn't take the whole panel down.
  const results = await Promise.all(
    icaos.map(async (icao) => ({
      icao,
      metar: await getMetar(icao).catch(toFetchOutcome),
      taf: await getTaf(icao).catch(toFetchOutcome),
    })),
  );

  return (
    <SectionPanel title="Weather & ATIS">
      <div className="grid gap-3 lg:grid-cols-2">
        {results.map((airport) => (
          <AirportWeather key={airport.icao} {...airport} />
        ))}
      </div>
      <p className="mt-3 text-[0.65rem] text-muted-foreground/70">
        Source: Aviation Weather Center via weather-service. METAR cached 5 min,
        TAF cached 30 min. ATIS + PIREP land with M2-M-4.
      </p>
    </SectionPanel>
  );
}

type FetchOutcome =
  | { ok: true; report: WeatherReportResponse }
  | { ok: false; status: number; message: string };

function toFetchOutcome(err: unknown): FetchOutcome {
  if (err instanceof ApiError) {
    return { ok: false, status: err.status, message: err.message };
  }
  return { ok: false, status: 0, message: String(err) };
}

function AirportWeather({
  icao,
  metar,
  taf,
}: {
  icao: string;
  metar: WeatherReportResponse | FetchOutcome;
  taf: WeatherReportResponse | FetchOutcome;
}) {
  const metarOutcome = normalizeOutcome(metar);
  const tafOutcome = normalizeOutcome(taf);

  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-sm font-semibold text-foreground">
          {icao}
        </span>
        {metarOutcome.ok && (
          <CacheBadge cacheHit={metarOutcome.report.cache_hit} />
        )}
      </div>

      <ReportRow label="METAR" outcome={metarOutcome} />
      <ReportRow label="TAF" outcome={tafOutcome} />
    </div>
  );
}

function normalizeOutcome(
  value: WeatherReportResponse | FetchOutcome,
): FetchOutcome {
  if ("ok" in value) return value;
  return { ok: true, report: value };
}

function ReportRow({
  label,
  outcome,
}: {
  label: string;
  outcome: FetchOutcome;
}) {
  return (
    <div className="mt-2">
      <div className="mb-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      {outcome.ok ? (
        <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[0.7rem] leading-snug text-foreground/90">
          {outcome.report.raw}
        </pre>
      ) : (
        <p className="m-0 text-[0.7rem] italic text-muted-foreground/70">
          {outcome.status === 404
            ? `No current ${label} for this airport.`
            : outcome.status === 502
              ? `${label} feed unreachable — try Refresh Weather.`
              : `${label} unavailable (${outcome.status || "error"}).`}
        </p>
      )}
    </div>
  );
}

function CacheBadge({ cacheHit }: { cacheHit: boolean }) {
  return (
    <span
      className={
        "rounded-md px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] " +
        (cacheHit
          ? "bg-muted text-muted-foreground"
          : "bg-status-green/15 text-status-green")
      }
      title={
        cacheHit
          ? "Served from the local cache (refreshed within the TTL window)"
          : "Just fetched from Aviation Weather Center"
      }
    >
      {cacheHit ? "cached" : "live"}
    </span>
  );
}
