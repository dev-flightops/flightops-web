import { FlightCategoryBadge } from "@/components/weather/flight-category-badge";
import { ApiError } from "@/lib/api/client";
import { batchWeather } from "@/lib/api/weather";
import type { WeatherReportResponse } from "@/lib/api/types";
import {
  fieldFormat,
  metarAge,
  metarSummary,
  routeRoleFor,
  utcHm,
  type RouteRole,
} from "@/lib/weather-format";

import { DisabledPanel, SectionPanel } from "./section-panel";

// Backend caps batch at 20 requests — slice longer routes (one METAR +
// one TAF per stop = 10-stop max). If the dispatcher pastes a wild
// 30-stop bush route, we show the first 10 and a footer note.
const MAX_STOPS = 10;

/**
 * Weather & ATIS panel — M2-G-14.
 *
 * Rich card layout matching the legacy peregrineflight.com style:
 *   - Panel header surfaces the airport count + pulled timestamp
 *   - Each card has a DEPARTURE / EN ROUTE / DESTINATION role pill,
 *     larger VFR/IFR badge, METAR age, sentence-case human summary,
 *     5-column field grid, then the raw METAR + TAF text blocks
 *
 * Failures degrade per-row: bad ICAOs (404) and 502s still render a
 * card, just with the parsed fields blanked and a fallback message
 * where the raw text would be.
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

  // Dedup preserving the dispatcher's order so role tags (DEPARTURE,
  // DESTINATION) line up with what they typed.
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

  // Index by (icao, kind) so each card pulls its data in O(1).
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

  // Most recent parsed_at across all reports for the panel header
  // "pulled HH:MMZ". `batch.items` is already filtered to successful
  // fetches, so this can be empty if every ICAO 404'd.
  const pulledAt = batch.items
    .map((i) => i.parsed_at)
    .sort()
    .pop();

  const cards = stops.map((icao, idx) => ({
    icao,
    role: routeRoleFor(idx, stops.length),
    metar: outcomeFor(icao, "metar", lookup, errorLookup),
    taf: outcomeFor(icao, "taf", lookup, errorLookup),
  }));

  return (
    <SectionPanel
      title={
        <span className="flex items-baseline gap-2">
          Weather &amp; ATIS
          <span className="text-[0.6rem] font-normal normal-case tracking-normal text-muted-foreground/70">
            {`${stops.length} ${stops.length === 1 ? "airport" : "airports"}${pulledAt ? ` · pulled ${utcHm(pulledAt)}` : ""}`}
          </span>
        </span>
      }
    >
      <div className="space-y-3">
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
  return { ok: false, status: 0, message: `no ${kind} returned for ${icao}` };
}

type FetchOutcome =
  | { ok: true; report: WeatherReportResponse }
  | { ok: false; status: number; message: string };

// ---- Airport card ------------------------------------------------------------

function AirportWeather({
  icao,
  role,
  metar,
  taf,
}: {
  icao: string;
  role: RouteRole | null;
  metar: FetchOutcome;
  taf: FetchOutcome;
}) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-4">
      <AirportHeader icao={icao} role={role} metar={metar} />

      {metar.ok && <MetarSummaryAndGrid report={metar.report} />}

      <div className="mt-3 space-y-3">
        <ReportBlock label="METAR" outcome={metar} />
        <ReportBlock label="TAF" outcome={taf} />
      </div>
    </div>
  );
}

function AirportHeader({
  icao,
  role,
  metar,
}: {
  icao: string;
  role: RouteRole | null;
  metar: FetchOutcome;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <div className="flex items-baseline gap-2">
        {role && <RoleTag role={role} />}
        <span className="font-mono text-base font-semibold text-foreground">
          {icao}
        </span>
        {metar.ok && metar.report.flight_category && (
          <FlightCategoryBadge
            category={metar.report.flight_category}
            size="lg"
          />
        )}
        <span className="text-xs text-muted-foreground/70">
          Official METAR/TAF
        </span>
      </div>
      {metar.ok && (
        <span className="text-xs text-muted-foreground/70">
          METAR age: {metarAge(metar.report.parsed_at)}
        </span>
      )}
    </div>
  );
}

function MetarSummaryAndGrid({ report }: { report: WeatherReportResponse }) {
  const summary = metarSummary(report);
  return (
    <>
      {summary && (
        <p className="m-0 mb-3 text-[0.95rem] font-bold leading-snug text-foreground">
          {summary}.
        </p>
      )}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <FieldCell label="Ceiling" value={fieldFormat.ceiling(report)} />
        <FieldCell label="Visibility" value={fieldFormat.visibility(report)} />
        <FieldCell label="Wind" value={fieldFormat.wind(report)} />
        <FieldCell label="Temp / Dew" value={fieldFormat.tempDew(report)} />
        <FieldCell label="Altimeter" value={fieldFormat.altimeter(report)} />
      </dl>
    </>
  );
}

function FieldCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="m-0 text-sm font-bold text-foreground">{value}</dd>
    </div>
  );
}

function ReportBlock({
  label,
  outcome,
}: {
  label: string;
  outcome: FetchOutcome;
}) {
  return (
    <div>
      <p className="mb-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
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

// ---- Tag / badge components --------------------------------------------------

const ROLE_TAG_STYLE: Record<RouteRole, string> = {
  DEPARTURE: "bg-status-blue/15 text-status-blue",
  "EN ROUTE": "bg-muted text-muted-foreground",
  DESTINATION: "bg-status-blue/15 text-status-blue",
};

function RoleTag({ role }: { role: RouteRole }) {
  return (
    <span
      className={
        "rounded-md px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] " +
        ROLE_TAG_STYLE[role]
      }
    >
      {role}
    </span>
  );
}
