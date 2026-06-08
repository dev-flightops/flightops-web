import { ApiError } from "@/lib/api/client";
import { batchWeather } from "@/lib/api/weather";
import type {
  FlightCategory,
  WeatherReportResponse,
} from "@/lib/api/types";

import { DisabledPanel, SectionPanel } from "./section-panel";

// Backend caps batch at 20 requests — slice longer routes (one METAR +
// one TAF per stop = 10-stop max). If the dispatcher pastes a wild
// 30-stop bush route, we show the first 10 and a footer note.
const MAX_STOPS = 10;

/**
 * Weather & ATIS panel — M2-G-12.
 *
 * Pulls METAR + TAF for every ICAO in the routing (or [origin, destination]
 * if the dispatcher hasn't typed a routing yet). One POST /weather/batch
 * round-trip total, regardless of stop count, with per-item failures
 * isolated in the response.
 *
 * `cache_hit` drives a small "live" / "cached" badge per airport;
 * `flight_category` drives the colored VFR/MVFR/IFR/LIFR pill.
 */
export async function WeatherPanel({ icaos }: { icaos: string[] }) {
  if (icaos.length === 0) {
    return (
      <DisabledPanel
        title="Weather & ATIS"
        milestone="M2"
        hint="Pick a flight from the dropdown above, or type a routing in the Route panel, to pull METAR + TAF for every stop."
      />
    );
  }

  // Dedup preserving the dispatcher's order. The backend dedups too, but
  // doing it here saves us from rendering duplicate cards.
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const icao of icaos) {
    if (!seen.has(icao)) {
      seen.add(icao);
      uniq.push(icao);
    }
  }

  const truncated = uniq.length > MAX_STOPS;
  const stops = truncated ? uniq.slice(0, MAX_STOPS) : uniq;

  // One round-trip — backend fans out concurrently to AWC.
  let batch;
  try {
    batch = await batchWeather(
      stops.flatMap((icao) => [
        { icao, kind: "metar" as const },
        { icao, kind: "taf" as const },
      ]),
    );
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    return (
      <SectionPanel title="Weather & ATIS">
        <p className="text-xs italic text-muted-foreground/70">
          Weather feed unavailable ({status || "error"}) — try Refresh Weather
          in a moment.
        </p>
      </SectionPanel>
    );
  }

  // Index the batch response by (icao, kind) so the renderer can pull
  // each card's data without an O(N²) scan.
  const lookup = new Map<string, WeatherReportResponse>();
  for (const item of batch.items) {
    lookup.set(`${item.icao}/${item.kind}`, item);
  }
  const errorLookup = new Map<string, { status: number; detail: string }>();
  for (const err of batch.errors) {
    errorLookup.set(`${err.icao}/${err.kind}`, {
      status: err.status,
      detail: err.detail,
    });
  }

  const cards = stops.map((icao) => ({
    icao,
    metar: outcomeFor(icao, "metar", lookup, errorLookup),
    taf: outcomeFor(icao, "taf", lookup, errorLookup),
  }));

  return (
    <SectionPanel title="Weather & ATIS">
      <div className="grid gap-3 lg:grid-cols-2">
        {cards.map((airport) => (
          <AirportWeather key={airport.icao} {...airport} />
        ))}
      </div>
      {truncated && (
        <p className="mt-2 text-[0.65rem] italic text-status-yellow/90">
          Showing first {MAX_STOPS} stops of {uniq.length}. Trim the route or
          break the trip into legs for full weather coverage.
        </p>
      )}
      <p className="mt-3 text-[0.65rem] text-muted-foreground/70">
        Source: Aviation Weather Center via weather-service. METAR cached 5 min,
        TAF cached 30 min. ATIS + PIREP land with M2-M-4.
      </p>
    </SectionPanel>
  );
}

function outcomeFor(
  icao: string,
  kind: "metar" | "taf",
  ok: Map<string, WeatherReportResponse>,
  bad: Map<string, { status: number; detail: string }>,
): FetchOutcome {
  const report = ok.get(`${icao}/${kind}`);
  if (report) return { ok: true, report };
  const err = bad.get(`${icao}/${kind}`);
  if (err) return { ok: false, status: err.status, message: err.detail };
  // Neither item nor explicit error — shouldn't happen given the backend
  // contract, but be defensive: render as a generic "unavailable".
  return { ok: false, status: 0, message: `no ${kind} returned for ${icao}` };
}

type FetchOutcome =
  | { ok: true; report: WeatherReportResponse }
  | { ok: false; status: number; message: string };

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
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold text-foreground">
            {icao}
          </span>
          {metarOutcome.ok && metarOutcome.report.flight_category && (
            <FlightCategoryBadge category={metarOutcome.report.flight_category} />
          )}
        </div>
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

// Standard FAA flight-category color scheme (matches aviationweather.gov):
//   VFR   green     ceiling >= 3000 ft AND vis >= 5 SM
//   MVFR  blue      ceiling 1000-3000 ft OR vis 3-5 SM
//   IFR   red       ceiling 500-1000 ft  OR vis 1-3 SM
//   LIFR  magenta   ceiling < 500 ft     OR vis < 1 SM
const FLIGHT_CATEGORY_STYLE: Record<FlightCategory, { className: string; title: string }> = {
  VFR: {
    className: "bg-status-green/15 text-status-green",
    title: "VFR — ceiling ≥ 3000 ft and visibility ≥ 5 SM",
  },
  MVFR: {
    className: "bg-status-blue/15 text-status-blue",
    title: "Marginal VFR — ceiling 1000–3000 ft or visibility 3–5 SM",
  },
  IFR: {
    className: "bg-status-red/15 text-status-red",
    title: "IFR — ceiling 500–1000 ft or visibility 1–3 SM",
  },
  LIFR: {
    className: "bg-status-purple/15 text-status-purple",
    title: "Low IFR — ceiling < 500 ft or visibility < 1 SM",
  },
};

function FlightCategoryBadge({ category }: { category: FlightCategory }) {
  const { className, title } = FLIGHT_CATEGORY_STYLE[category];
  return (
    <span
      className={
        "rounded-md px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] " +
        className
      }
      title={title}
    >
      {category}
    </span>
  );
}
