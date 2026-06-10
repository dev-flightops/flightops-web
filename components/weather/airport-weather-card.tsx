import type { WeatherReportResponse } from "@/lib/api/types";
import { metarAge, metarSummary } from "@/lib/weather-format";

import { FlightCategoryBadge } from "./flight-category-badge";

/**
 * Single-airport METAR + TAF card used by /weather standalone (M2-G-24).
 *
 * Lighter than the dispatch packet's per-airport card — no route role
 * tags, no 5-column parsed-field grid (the dispatch packet is the
 * place for that level of detail). Shows the ICAO, flight-category
 * badge, the human-language METAR summary sentence, then the raw
 * METAR + TAF blocks. Failures degrade per-row.
 */
export interface WeatherFetchOutcome {
  ok: boolean;
  report?: WeatherReportResponse;
  status?: number;
  message?: string;
}

export function AirportWeatherCard({
  icao,
  metar,
  taf,
}: {
  icao: string;
  metar: WeatherFetchOutcome;
  taf: WeatherFetchOutcome;
}) {
  return (
    <article className="rounded-md border border-border bg-card p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-base font-semibold text-foreground">
            {icao}
          </span>
          {metar.ok && metar.report?.flight_category && (
            <FlightCategoryBadge
              category={metar.report.flight_category}
              size="lg"
            />
          )}
        </div>
        {metar.ok && metar.report && (
          <span className="text-xs text-muted-foreground/70">
            METAR age: {metarAge(metar.report.parsed_at)}
          </span>
        )}
      </header>

      {metar.ok && metar.report && (
        <p className="m-0 mb-3 text-[0.9rem] font-semibold leading-snug text-foreground">
          {metarSummary(metar.report)}.
        </p>
      )}

      <div className="space-y-3">
        <ReportBlock label="METAR" outcome={metar} />
        <ReportBlock label="TAF" outcome={taf} />
      </div>
    </article>
  );
}

function ReportBlock({
  label,
  outcome,
}: {
  label: string;
  outcome: WeatherFetchOutcome;
}) {
  return (
    <div>
      <p className="mb-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      {outcome.ok && outcome.report ? (
        <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[0.7rem] leading-snug text-foreground/90">
          {outcome.report.raw}
        </pre>
      ) : (
        <p className="m-0 text-[0.7rem] italic text-muted-foreground/70">
          {outcome.status === 404
            ? `No current ${label} for this airport.`
            : outcome.status === 502
              ? `${label} feed unreachable — try again in a moment.`
              : `${label} unavailable${outcome.status ? ` (${outcome.status})` : ""}.`}
        </p>
      )}
    </div>
  );
}
